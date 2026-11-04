// @vitest-environment jsdom
import { jsonResponse, routeFetch, textResponse } from "@brain-bbqs/test-utils/vitest";
import { resolveConfig } from "@brain-bbqs/ember-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SWEEP_BUDGET_BYTES } from "../../src/lib/archives";
import { MAX_TABLE_BYTES } from "../../src/lib/electrodeTable";
import { fakeArchiveBrowse } from "../../src/lib/testInjection";
import { createBrowsePane, type BrowsePaneElements, type BrowsePaneHost } from "../../src/ui/browsePane";
import { API, archiveRoutes, BUCKET, bucketUrl, listingXml, type FakeDataset } from "./helpers/fakeArchive";

function elements(): BrowsePaneElements {
  const els: BrowsePaneElements = {
    browseFilter: document.createElement("input"),
    browseStatus: document.createElement("div"),
    browseDandisets: document.createElement("ul"),
    browseTables: document.createElement("ul"),
    browseTableHeading: document.createElement("span"),
    browseDandisetLink: document.createElement("a"),
  };
  document.body.replaceChildren(...Object.values(els));
  return els;
}

function host(overrides: Partial<BrowsePaneHost> = {}): BrowsePaneHost {
  return {
    config: () => resolveConfig({ dandisetId: "", oauthAccessToken: "" }),
    signedIn: () => false,
    hasToken: () => false,
    ensureFreshToken: vi.fn(() => Promise.resolve()),
    username: vi.fn(() => Promise.resolve("ada")),
    fakeListing: () => null,
    openTable: vi.fn(),
    ...overrides,
  };
}

function rows(list: HTMLUListElement): (string | null)[] {
  return [...list.querySelectorAll("li")].map((li) => li.textContent);
}

function rowButton(list: HTMLUListElement, text: string): HTMLButtonElement {
  const button = [...list.querySelectorAll<HTMLButtonElement>(".browse-item")].find((b) =>
    b.textContent?.includes(text),
  );
  if (!button) throw new Error(`No row containing ${text}`);
  return button;
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the browse pane, signed out", () => {
  const datasets: FakeDataset[] = [
    {
      id: "000001",
      name: "Alpha",
      tables: [
        ["sub-01/ieeg/sub-01_electrodes.tsv", 2048],
        ["big.csv", MAX_TABLE_BYTES + 1],
      ],
    },
    { id: "000002", name: "Beta", tables: [["video.mp4", 10]] },
    { id: "000003", tables: [["hidden.tsv", 1]] },
    { id: "000004", name: "Gamma", tables: [["electrodes.csv", 512]] },
  ];

  it("lists the public datasets holding tables, by name and count", async () => {
    vi.stubGlobal("fetch", routeFetch(archiveRoutes(datasets, ["000003"])));
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    expect(rows(els.browseDandisets)).toEqual(["000001Alpha2 tables", "000004Gamma1 table"]);
    expect(els.browseStatus.textContent).toBe("");
    expect(rows(els.browseTables)).toEqual(["Choose a dataset to see the tables in it."]);
    expect(JSON.parse(localStorage.getItem("ember-rave-visualizer.archive-names.v1") ?? "{}").names).toEqual({
      "000001": "Alpha",
      "000002": "Beta",
      "000004": "Gamma",
    });
  });

  it("opens a dataset's tables, marking the one too large to load and the one picked", async () => {
    vi.stubGlobal("fetch", routeFetch(archiveRoutes(datasets, ["000003"])));
    const els = elements();
    const paneHost = host();
    await createBrowsePane(els, paneHost).refresh();

    rowButton(els.browseDandisets, "Alpha").click();
    expect(rowButton(els.browseDandisets, "Alpha").getAttribute("aria-current")).toBe("true");
    expect(els.browseTableHeading.textContent).toBe("Tables in 000001");
    expect(els.browseDandisetLink.hidden).toBe(false);
    expect(els.browseDandisetLink.href).toBe("https://dandi.emberarchive.org/dandiset/000001/draft");
    expect(rows(els.browseTables)).toEqual(["big.csv20.00 MB", "sub-01/ieeg/sub-01_electrodes.tsv2.0 KB"]);
    const big = rowButton(els.browseTables, "big.csv");
    expect(big.classList.contains("blocked")).toBe(true);
    expect(big.title).toMatch(/20 MB limit/);

    rowButton(els.browseTables, "sub-01").click();
    expect(paneHost.openTable).toHaveBeenCalledWith(
      expect.objectContaining({ path: "sub-01/ieeg/sub-01_electrodes.tsv" }),
    );
    expect(rowButton(els.browseTables, "sub-01").getAttribute("aria-current")).toBe("true");
    expect(big.hasAttribute("aria-current")).toBe(false);
  });

  it("filters by identifier, title or file name", async () => {
    vi.stubGlobal("fetch", routeFetch(archiveRoutes(datasets, ["000003"])));
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    vi.useFakeTimers();
    const filter = async (query: string): Promise<(string | null)[]> => {
      els.browseFilter.value = query;
      els.browseFilter.dispatchEvent(new Event("input"));
      await vi.advanceTimersByTimeAsync(150);
      return rows(els.browseDandisets);
    };
    expect(await filter("gamma")).toEqual(["000004Gamma1 table"]);
    expect(await filter("0001")).toEqual(["000001Alpha2 tables"]);
    expect(await filter("electrodes.csv")).toEqual(["000004Gamma1 table"]);
    expect(await filter("nothing like it")).toEqual(["No dataset matches that filter."]);
  });

  it("says so when the bucket cannot be listed", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([{ match: BUCKET, respond: () => textResponse("down", 500) }, ...archiveRoutes([])]),
    );
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    expect(els.browseStatus.textContent).toMatch(/^Could not read the EMBER archive: GET .* HTTP 500/);
    expect(els.browseStatus.classList.contains("err")).toBe(true);
  });

  it("says so when no dataset holds a table", async () => {
    vi.stubGlobal("fetch", routeFetch(archiveRoutes([{ id: "000002", name: "Beta", tables: [] }])));
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    expect(rows(els.browseDandisets)).toEqual(["No EMBER dataset holds a table yet."]);
  });

  it("does not reread names it already holds", async () => {
    localStorage.setItem(
      "ember-rave-visualizer.archive-names.v1",
      JSON.stringify({ savedAt: Date.now(), names: { "000004": "Cached Gamma" } }),
    );
    const fetchMock = routeFetch(archiveRoutes([{ id: "000004", name: "Gamma", tables: [["e.tsv", 1]] }]));
    vi.stubGlobal("fetch", fetchMock);
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    expect(rows(els.browseDandisets)).toEqual(["000004Cached Gamma1 table"]);
    expect(fetchMock.callsTo("dandiset.jsonld")).toEqual([]);
  });

  it("redraws a sweep's progress at most once a frame", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch(
        archiveRoutes([
          { id: "000001", name: "A", tables: [["e.tsv", 1]] },
          { id: "000002", name: "B", tables: [["f.tsv", 1]] },
        ]),
      ),
    );
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    expect(raf.mock.calls.length).toBeLessThanOrEqual(1);
    expect(rows(els.browseDandisets)).toEqual(["000001A1 table", "000002B1 table"]);
  });
});

describe("an archive too large to sweep", () => {
  const huge = SWEEP_BUDGET_BYTES + 1;
  const datasets: FakeDataset[] = [
    { id: "000001", name: "Alpha", manifestBytes: huge, tables: [["e.tsv", 1]] },
    { id: "000002", name: "Beta", manifestBytes: 10 },
    { id: "000003", name: "Empty", manifestBytes: 10, tables: [] },
  ];

  it("lists every candidate and reads a dataset's file list when it is opened", async () => {
    vi.stubGlobal("fetch", routeFetch(archiveRoutes(datasets)));
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    expect(rows(els.browseDandisets)).toEqual(["000001Alpha32.00 MB", "000002Beta10 B", "000003Empty10 B"]);
    expect(els.browseStatus.textContent).toBe("3 EMBER datasets.");

    rowButton(els.browseDandisets, "Alpha").click();
    expect(rows(els.browseTables)).toEqual(["Reading the file list for 000001 (32.00 MB)…"]);
    await vi.waitFor(() => expect(rows(els.browseTables)).toEqual(["e.tsv1 B"]));
    expect(rows(els.browseDandisets)[0]).toBe("000001Alpha1 table");

    rowButton(els.browseDandisets, "Empty").click();
    await vi.waitFor(() => expect(rows(els.browseTables)).toEqual(["This dataset holds no .tsv or .csv tables."]));
    expect(rows(els.browseDandisets)[2]).toBe("000003Emptyno tables");

    rowButton(els.browseDandisets, "Alpha").click();
    expect(rows(els.browseTables)).toEqual(["e.tsv1 B"]);

    rowButton(els.browseDandisets, "Beta").click();
    await vi.waitFor(() =>
      expect(rows(els.browseTables)[0]).toMatch(/^The file list for 000002 could not be read: GET .* HTTP 403/),
    );
  });

  it("drops a file list that lands after another dataset was opened", async () => {
    let release: () => void = () => {};
    const slow = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal(
      "fetch",
      routeFetch([
        {
          match: `${BUCKET}/dandisets/000002/draft/assets.jsonld`,
          respond: async () => {
            await slow;
            return jsonResponse([{ path: "late.tsv", contentUrl: [bucketUrl("000002", "late.tsv")] }]);
          },
        },
        ...archiveRoutes(datasets),
      ]),
    );
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    rowButton(els.browseDandisets, "Beta").click();
    rowButton(els.browseDandisets, "Alpha").click();
    await vi.waitFor(() => expect(rows(els.browseTables)).toEqual(["e.tsv1 B"]));
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rows(els.browseTables)).toEqual(["e.tsv1 B"]);
  });

  it("caps the rows it draws at once", async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ id: String(i).padStart(6, "0"), manifestBytes: huge }));
    vi.stubGlobal("fetch", routeFetch(archiveRoutes(many)));
    const els = elements();
    await createBrowsePane(els, host()).refresh();
    const listed = rows(els.browseDandisets);
    expect(listed.length).toBe(201);
    expect(listed.at(-1)).toBe("Showing 200 of 201 matches; narrow the filter to see the rest.");
  });
});

describe("the browse pane, signed in", () => {
  const owned = `${API}/dandisets/?user=me&embargoed=true&page_size=1000`;
  const signedInHost = (overrides: Partial<BrowsePaneHost> = {}) =>
    host({
      config: () => resolveConfig({ dandisetId: "", oauthAccessToken: "tok" }),
      signedIn: () => true,
      hasToken: () => true,
      ...overrides,
    });

  it("merges in the embargoed datasets the visitor owns, read through the API", async () => {
    const fetchMock = routeFetch([
      {
        match: owned,
        respond: () =>
          jsonResponse({
            results: [{ identifier: "000009", embargo_status: "EMBARGOED", draft_version: { name: "Mine" } }],
          }),
      },
      { match: "/dandisets/000009/users/", respond: () => jsonResponse([{ username: "ada" }]) },
      {
        match: "/dandisets/000009/versions/draft/assets/",
        respond: () => jsonResponse({ results: [{ asset_id: "a1", path: "sub-01_electrodes.tsv", size: 5 }] }),
      },
      ...archiveRoutes([{ id: "000001", name: "Alpha", tables: [["e.tsv", 1]] }]),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const els = elements();
    const paneHost = signedInHost();
    await createBrowsePane(els, paneHost).refresh();
    expect(paneHost.ensureFreshToken).toHaveBeenCalled();
    expect(rows(els.browseDandisets)).toEqual(["000001Alpha1 table", "000009embargoedMine1 table"]);
    expect(els.browseDandisets.querySelector(".badge.restricted")?.textContent).toBe("embargoed");

    rowButton(els.browseDandisets, "Mine").click();
    rowButton(els.browseTables, "sub-01").click();
    expect(paneHost.openTable).toHaveBeenCalledWith(
      expect.objectContaining({ embargoed: true, assetUrl: `${API}/assets/a1/download/` }),
    );
  });

  it("carries on with the public datasets when the owned ones cannot be listed", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        { match: owned, respond: () => textResponse("no", 500) },
        ...archiveRoutes([{ id: "000001", name: "Alpha", tables: [["e.tsv", 1]] }]),
      ]),
    );
    const els = elements();
    await createBrowsePane(els, signedInHost()).refresh();
    expect(rows(els.browseDandisets)).toEqual(["000001Alpha1 table"]);
    expect(console.warn).toHaveBeenCalledWith("Could not list your embargoed datasets:", expect.any(Error));
  });

  it("names the count of embargoed datasets while the archive is too large to sweep", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        {
          match: owned,
          respond: () => jsonResponse({ results: [{ identifier: "000009", embargo_status: "EMBARGOED" }] }),
        },
        { match: "/dandisets/000009/users/", respond: () => jsonResponse([{ username: "ada" }]) },
        ...archiveRoutes([{ id: "000001", name: "Alpha", manifestBytes: SWEEP_BUDGET_BYTES + 1 }]),
      ]),
    );
    const els = elements();
    await createBrowsePane(els, signedInHost()).refresh();
    expect(els.browseStatus.textContent).toBe("2 EMBER datasets, 1 of them embargoed and yours.");
    expect(rows(els.browseDandisets)[1]).toBe("000009embargoed");
  });
});

describe("rebuilding", () => {
  it("rereads only when the sign-in state the list was built under has changed, reopening the open dataset", async () => {
    const fetchMock = routeFetch(archiveRoutes([{ id: "000001", name: "Alpha", tables: [["e.tsv", 1]] }]));
    vi.stubGlobal("fetch", fetchMock);
    let signedIn = false;
    const els = elements();
    const pane = createBrowsePane(els, host({ signedIn: () => signedIn }));
    pane.syncToAuth();
    expect(fetchMock.calls).toEqual([]);

    await pane.refresh();
    rowButton(els.browseDandisets, "Alpha").click();
    rowButton(els.browseTables, "e.tsv").click();
    const listings = fetchMock.callsTo("list-type=2").length;
    pane.syncToAuth();
    expect(fetchMock.callsTo("list-type=2").length).toBe(listings);

    signedIn = true;
    pane.syncToAuth();
    await vi.waitFor(() => expect(fetchMock.callsTo("list-type=2").length).toBe(listings + 1));
    await vi.waitFor(() => expect(els.browseTableHeading.textContent).toBe("Tables in 000001"));
    await vi.waitFor(() => expect(rowButton(els.browseTables, "e.tsv").getAttribute("aria-current")).toBe("true"));
  });

  it("lets a superseded pass neither paint nor report", async () => {
    let release: () => void = () => {};
    const slow = new Promise<void>((resolve) => (release = resolve));
    let first = true;
    vi.stubGlobal(
      "fetch",
      routeFetch([
        {
          match: `${BUCKET}/?list-type=2`,
          respond: async () => {
            if (first) {
              first = false;
              await slow;
              return textResponse(listingXml([{ id: "000666" }]));
            }
            return textResponse(listingXml([{ id: "000001" }]));
          },
        },
        ...archiveRoutes([{ id: "000001", name: "Alpha", tables: [["e.tsv", 1]] }]),
      ]),
    );
    const els = elements();
    const pane = createBrowsePane(els, host());
    const stale = pane.refresh();
    await pane.refresh();
    release();
    await stale;
    expect(rows(els.browseDandisets)).toEqual(["000001Alpha1 table"]);
    expect(els.browseStatus.textContent).toBe("");
  });

  it("keeps a superseded naming pass from painting, saving or sweeping", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    let stale = true;
    const fetchMock = routeFetch([
      {
        match: "/000001/draft/dandiset.jsonld",
        respond: async () => {
          const thisCall = stale;
          if (thisCall) await held;
          return jsonResponse({ name: thisCall ? "Stale" : "Alpha" });
        },
      },
      ...archiveRoutes([
        { id: "000001", tables: [["e.tsv", 1]] },
        { id: "000002", name: "Beta", tables: [["f.tsv", 1]] },
      ]),
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const els = elements();
    const pane = createBrowsePane(els, host());
    const superseded = pane.refresh();
    await vi.waitFor(() => expect(els.browseStatus.textContent).toBe("Naming datasets, 1 of 2…"));
    stale = false;
    await pane.refresh();
    const sweeps = fetchMock.callsTo("assets.jsonld").length;
    release();
    await superseded;
    expect(rows(els.browseDandisets)).toEqual(["000001Alpha1 table", "000002Beta1 table"]);
    expect(els.browseStatus.textContent).toBe("");
    expect(JSON.parse(localStorage.getItem("ember-rave-visualizer.archive-names.v1") ?? "{}").names["000001"]).toBe(
      "Alpha",
    );
    expect(fetchMock.callsTo("assets.jsonld").length).toBe(sweeps);
  });
});

describe("a faked listing", () => {
  it("is drawn as it is handed over, with nothing read from the archive", async () => {
    const fetchMock = routeFetch([]);
    vi.stubGlobal("fetch", fetchMock);
    const els = elements();
    await createBrowsePane(els, host({ fakeListing: () => fakeArchiveBrowse(4, true) })).refresh();
    expect(rows(els.browseDandisets)).toEqual(["214000Test dataset 13 tables", "214001embargoedTest dataset 21 table"]);
    expect(fetchMock.calls).toEqual([]);
  });
});
