import { bytes } from "@brain-bbqs/utils";
import { friendlyError, type ArchiveConfig } from "@brain-bbqs/ember-client";
import { loadCachedNames, saveCachedNames } from "../lib/archiveNames";
import {
  canSweep,
  dandisetWebUrl,
  fetchDandisetTables,
  hydrateDandisetNames,
  indexDandisets,
  listManifestObjects,
  mergeDandisets,
  sweepArchiveTables,
  tableRefusal,
  type ArchiveDandiset,
  type ArchiveTable,
} from "../lib/archives";
import { listEmbargoedTables, listOwnedEmbargoedDandisets, listPublicDandisetIds } from "../lib/embargoed";
import type { AppElements } from "./elements";

// Browsing EMBER for a table to load, as clip-extractor's ui/browsePane.ts does for video. What is
// public is read from EMBER's public bucket with no sign-in (lib/archives.ts); the embargoed
// datasets a signed-in visitor owns are asked of the API (lib/embargoed.ts) and merged into the
// same list.

export type BrowsePaneElements = Pick<
  AppElements,
  "browseFilter" | "browseStatus" | "browseDandisets" | "browseTables" | "browseTableHeading" | "browseDandisetLink"
>;

/** What the pane needs from the page around it. */
export interface BrowsePaneHost {
  /** The archive config the API calls run under. */
  config: () => ArchiveConfig;
  /** Whether the page reads as signed in, faked sign-ins included. What the pane can see changes
   * with this and nothing else, so it is the only thing that forces a rebuild. */
  signedIn: () => boolean;
  /** Whether there is a real token to make an authenticated call with. */
  hasToken: () => boolean;
  ensureFreshToken: () => Promise<void>;
  /** The signed-in account's username, which is what dataset ownership is checked against. */
  username: (cfg: ArchiveConfig) => Promise<string>;
  /** A `?test&remote_listing=` stand-in for the whole listing, or null on an ordinary load. */
  fakeListing: () => { datasets: ArchiveDandiset[]; tables: Map<string, ArchiveTable[]> } | null;
  /** Loads a table picked out of the list. */
  openTable: (table: ArchiveTable) => void;
}

export interface BrowsePane {
  /** Reads the archive from scratch. */
  refresh: () => Promise<void>;
  /** Re-reads it when signing in or out has changed what there is to see, and only once the pane
   * has been read at all. */
  syncToAuth: () => void;
}

/** Dataset rows put on the page at once, so a filter matching everything cannot flood it. */
const BROWSE_ROW_LIMIT = 200;

interface BrowseState {
  datasets: ArchiveDandiset[];
  /** Titles of the public datasets; an embargoed one carries its own from the API listing. */
  names: Map<string, string>;
  /** Tables per dataset id; a dataset missing from the map has not been read yet. */
  tables: Map<string, ArchiveTable[]>;
  /** Whether this pass reads every dataset's file list, and so lists only datasets holding tables. */
  sweeping: boolean;
  swept: boolean;
  selected: string | null;
  /** The asset URL of the table last picked, so its row stays marked. */
  selectedTable: string | null;
  abort: AbortController;
}

export function createBrowsePane(els: BrowsePaneElements, host: BrowsePaneHost): BrowsePane {
  let browse: BrowseState | null = null;
  /** Bumped on every rebuild, so a superseded pass cannot paint over the one that replaced it. */
  let generation = 0;
  let builtSignedIn = false;
  let filterTimer: ReturnType<typeof setTimeout> | undefined;
  let renderFrame: number | null = null;
  const rowLabels = new Map<string, HTMLElement>();
  const rowMeta = new Map<string, HTMLElement>();
  const tableRows = new Map<string, HTMLElement>();

  function say(message: string, error = false): void {
    els.browseStatus.textContent = message;
    els.browseStatus.classList.toggle("err", error);
  }

  function note(list: HTMLUListElement, message: string): void {
    const li = document.createElement("li");
    const p = document.createElement("p");
    p.className = "browse-empty";
    p.textContent = message;
    li.append(p);
    list.append(li);
  }

  function empty(list: HTMLUListElement, message: string): void {
    list.replaceChildren();
    note(list, message);
  }

  function tablesEmpty(message: string): void {
    tableRows.clear();
    empty(els.browseTables, message);
  }

  function nameOf(current: BrowseState, dandiset: ArchiveDandiset): string {
    return dandiset.name || current.names.get(dandiset.id) || "";
  }

  function countLine(current: BrowseState): string {
    const mine = current.datasets.filter((d) => d.embargoed).length;
    return `${current.datasets.length} EMBER datasets${mine ? `, ${mine} of them embargoed and yours` : ""}.`;
  }

  async function refresh(): Promise<void> {
    const reopen = browse?.selected ?? null;
    const picked = browse?.selectedTable ?? null;
    browse?.abort.abort();
    builtSignedIn = host.signedIn();
    const thisGeneration = ++generation;
    const current: BrowseState = {
      datasets: [],
      names: loadCachedNames(),
      tables: new Map(),
      sweeping: false,
      swept: false,
      selected: null,
      selectedTable: picked,
      abort: new AbortController(),
    };
    browse = current;
    const signal = current.abort.signal;
    els.browseDandisetLink.hidden = true;
    els.browseTableHeading.textContent = "Tables";
    tablesEmpty("Choose a dataset to see the tables in it.");
    els.browseDandisets.replaceChildren();

    const fake = host.fakeListing();
    if (fake) {
      current.datasets = fake.datasets;
      current.tables = fake.tables;
      current.sweeping = true;
      current.swept = true;
      renderDandisets();
      say("");
      return;
    }

    say("Reading the EMBER archive listing…");
    try {
      if (host.hasToken()) await host.ensureFreshToken();
      // Only the bucket listing may fail the whole pane; `publicIds` decides which of its candidates
      // are really public.
      const [candidates, owned, publicIds] = await Promise.all([
        listManifestObjects(signal).then(indexDandisets),
        listOwnedEmbargoed(signal),
        listPublicDandisetIds(host.config(), signal),
      ]);
      if (thisGeneration !== generation) return;
      current.datasets = mergeDandisets(
        candidates.filter((d) => publicIds.has(d.id)),
        owned,
      );
      current.sweeping = canSweep(current.datasets);
      renderDandisets();
      say(countLine(current));
      const previous = reopen ? current.datasets.find((d) => d.id === reopen) : undefined;
      if (previous) void selectDandiset(previous);
      await hydrateNames(current, thisGeneration);
      if (thisGeneration === generation) await sweepTables(current, thisGeneration);
    } catch (error) {
      if (signal.aborted) return;
      console.error("Could not read the EMBER archive:", error);
      say(`Could not read the EMBER archive: ${friendlyError(error)}`, true);
    }
  }

  async function listOwnedEmbargoed(signal: AbortSignal): Promise<ArchiveDandiset[]> {
    if (!host.hasToken()) return [];
    const cfg = host.config();
    try {
      return await listOwnedEmbargoedDandisets(cfg, await host.username(cfg));
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn("Could not list your embargoed datasets:", error);
      return [];
    }
  }

  async function hydrateNames(current: BrowseState, thisGeneration: number): Promise<void> {
    const missing = current.datasets.filter((d) => !d.embargoed && !current.names.has(d.id));
    if (!missing.length) return;
    let done = 0;
    await hydrateDandisetNames(
      missing,
      (dandiset, name) => {
        if (thisGeneration !== generation) return;
        done++;
        if (name) {
          current.names.set(dandiset.id, name);
          const label = rowLabels.get(dandiset.id);
          if (label) label.textContent = name;
        }
        say(`Naming datasets, ${done} of ${missing.length}…`);
      },
      current.abort.signal,
    );
    if (thisGeneration !== generation) return;
    saveCachedNames(current.names);
    say(countLine(current));
  }

  function readTables(dandiset: ArchiveDandiset, signal?: AbortSignal): Promise<ArchiveTable[]> {
    if (dandiset.embargoed) return listEmbargoedTables(host.config(), dandiset.id, signal);
    return fetchDandisetTables(dandiset, signal);
  }

  async function sweepTables(current: BrowseState, thisGeneration: number): Promise<void> {
    if (!current.sweeping) return;
    let done = 0;
    await sweepArchiveTables(
      current.datasets,
      readTables,
      (dandiset, tables) => {
        if (thisGeneration !== generation) return;
        done++;
        current.tables.set(dandiset.id, tables);
        if (tables.length) scheduleRender();
        say(`Looking for tables, ${done} of ${current.datasets.length} datasets…`);
      },
      current.abort.signal,
    );
    if (thisGeneration !== generation) return;
    current.swept = true;
    say("");
    renderDandisets();
  }

  function tableCount(count: number): string {
    if (count === 0) return "no tables";
    return count === 1 ? "1 table" : `${count} tables`;
  }

  /**
   * The datasets left visible. Wherever a sweep is reading file lists, a dataset is listed only once
   * it is known to hold a table, so the list fills in rather than showing every candidate and then
   * dropping most of them; on an archive too large to sweep every candidate is listed.
   */
  function visibleDandisets(current: BrowseState): ArchiveDandiset[] {
    const query = els.browseFilter.value.trim().toLowerCase();
    return current.datasets.filter((d) => {
      const tables = current.tables.get(d.id);
      if (current.sweeping && !tables?.length) return false;
      if (!query) return true;
      if (d.id.includes(query) || nameOf(current, d).toLowerCase().includes(query)) return true;
      return (tables ?? []).some((t) => t.path.toLowerCase().includes(query));
    });
  }

  interface RowParts {
    li: HTMLLIElement;
    button: HTMLButtonElement;
    labelEl: HTMLElement;
    metaEl: HTMLElement;
  }

  function row(id: string, label: string, meta: string, onClick: () => void, badge?: string): RowParts {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "browse-item";
    if (id || badge) {
      // The identifier and badge share one leading column, so titles line up down the list.
      const idCol = document.createElement("span");
      idCol.className = "browse-idcol";
      if (id) {
        const identifier = document.createElement("span");
        identifier.className = "browse-id";
        identifier.textContent = id;
        idCol.append(identifier);
      }
      if (badge) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "badge restricted";
        badgeEl.textContent = badge;
        idCol.append(badgeEl);
      }
      button.append(idCol);
    }
    const labelEl = document.createElement("span");
    labelEl.className = "browse-label";
    labelEl.textContent = label;
    const metaEl = document.createElement("span");
    metaEl.className = "browse-meta";
    metaEl.textContent = meta;
    button.append(labelEl, metaEl);
    button.addEventListener("click", onClick);
    li.append(button);
    return { li, button, labelEl, metaEl };
  }

  /** A redraw asked for by the sweep, held to one a frame. */
  function scheduleRender(): void {
    renderFrame ??= requestAnimationFrame(renderDandisets);
  }

  function emptyReason(current: BrowseState): string {
    if (current.sweeping && !current.swept) return "Looking for the datasets that hold tables…";
    return els.browseFilter.value.trim() ? "No dataset matches that filter." : "No EMBER dataset holds a table yet.";
  }

  function renderDandisets(): void {
    if (renderFrame !== null) cancelAnimationFrame(renderFrame);
    renderFrame = null;
    rowLabels.clear();
    rowMeta.clear();
    const current = browse;
    if (!current) return;
    const matches = visibleDandisets(current);
    if (!matches.length) {
      empty(els.browseDandisets, emptyReason(current));
      return;
    }
    const shown = matches.slice(0, BROWSE_ROW_LIMIT);
    els.browseDandisets.replaceChildren();
    for (const dandiset of shown) {
      const tables = current.tables.get(dandiset.id);
      const meta = tables ? tableCount(tables.length) : dandiset.embargoed ? "" : bytes(dandiset.manifestBytes);
      const { li, button, labelEl, metaEl } = row(
        dandiset.id,
        nameOf(current, dandiset),
        meta,
        () => void selectDandiset(dandiset),
        dandiset.embargoed ? "embargoed" : undefined,
      );
      if (dandiset.id === current.selected) button.setAttribute("aria-current", "true");
      rowLabels.set(dandiset.id, labelEl);
      rowMeta.set(dandiset.id, metaEl);
      els.browseDandisets.append(li);
    }
    if (matches.length > shown.length) {
      note(
        els.browseDandisets,
        `Showing ${shown.length} of ${matches.length} matches; narrow the filter to see the rest.`,
      );
    }
  }

  async function selectDandiset(dandiset: ArchiveDandiset): Promise<void> {
    const current = browse;
    if (!current) return;
    const thisGeneration = generation;
    current.selected = dandiset.id;
    renderDandisets();
    els.browseTableHeading.textContent = `Tables in ${dandiset.id}`;
    els.browseDandisetLink.href = dandisetWebUrl(dandiset);
    els.browseDandisetLink.hidden = false;
    const known = current.tables.get(dandiset.id);
    if (known) {
      renderTables(known);
      return;
    }
    const cost = dandiset.embargoed ? "" : ` (${bytes(dandiset.manifestBytes)})`;
    tablesEmpty(`Reading the file list for ${dandiset.id}${cost}…`);
    try {
      const tables = await readTables(dandiset, current.abort.signal);
      if (thisGeneration !== generation || current.selected !== dandiset.id) return;
      current.tables.set(dandiset.id, tables);
      const meta = rowMeta.get(dandiset.id);
      if (meta) meta.textContent = tableCount(tables.length);
      renderTables(tables);
    } catch (error) {
      if (current.abort.signal.aborted || thisGeneration !== generation) return;
      console.error(`Could not read the file list for ${dandiset.id}:`, error);
      tablesEmpty(`The file list for ${dandiset.id} could not be read: ${friendlyError(error)}`);
    }
  }

  function markSelectedTable(): void {
    for (const [assetUrl, button] of tableRows) {
      if (assetUrl === browse?.selectedTable) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
  }

  function renderTables(tables: readonly ArchiveTable[]): void {
    if (!tables.length) {
      tablesEmpty("This dataset holds no .tsv or .csv tables.");
      return;
    }
    tableRows.clear();
    els.browseTables.replaceChildren();
    for (const table of tables) {
      // Marked in the listing, beside the size that decided it, rather than only once picked.
      const refusal = tableRefusal(table);
      const { li, button } = row("", table.path, bytes(table.size), () => pickTable(table));
      if (refusal) {
        button.classList.add("blocked");
        button.title = refusal;
      }
      tableRows.set(table.assetUrl, button);
      els.browseTables.append(li);
    }
    markSelectedTable();
  }

  function pickTable(table: ArchiveTable): void {
    if (browse) browse.selectedTable = table.assetUrl;
    markSelectedTable();
    host.openTable(table);
  }

  els.browseFilter.addEventListener("input", () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(renderDandisets, 150);
  });

  return {
    refresh,
    syncToAuth: () => {
      if (browse && builtSignedIn !== host.signedIn()) void refresh();
    },
  };
}
