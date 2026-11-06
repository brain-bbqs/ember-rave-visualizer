import { runQueue } from "@brain-bbqs/utils";
import { EMBER_INSTANCE } from "@brain-bbqs/ember-client";
import { isTableFileName, MAX_TABLE_BYTES } from "./electrodeTable";

// Browsing EMBER for a table to load, read the way clip-extractor's lib/archives.ts reads it for
// video, without asking the archive's REST API anything.
//
// EMBER publishes, in its public S3 bucket, a static manifest per dataset version:
// `dandisets/<id>/<version>/dandiset.jsonld` names the dataset, and `assets.jsonld` lists every
// file in it with its path, size and the URLs its bytes can be read from. One anonymous
// ListObjectsV2 over `dandisets/` says what exists (and how large each manifest is), then plain GETs
// of the manifests that matter. The bucket answers with `Access-Control-Allow-Origin: *`, so none of
// this needs a token.
//
// An embargoed dataset is listed in the bucket too, and the bucket's read permissions do not track
// the archive's embargo state, so this file only finds candidates: which of them are public is
// decided against the API by lib/embargoed.ts's listPublicDandisetIds.

export interface PublicArchive {
  /** Bucket name; also how an asset's S3 `contentUrl` is told apart from its API one. */
  bucket: string;
  /** Origin the bucket is listed and read through. */
  origin: string;
  /** The archive's web UI, for linking out to a dataset's own page. */
  web: string;
}

/** EMBER's public bucket, as registered on the AWS Registry of Open Data
 * (https://registry.opendata.aws/ember/). */
export const EMBER_ARCHIVE: PublicArchive = {
  bucket: "ember-open-data",
  origin: "https://ember-open-data.s3.amazonaws.com",
  web: EMBER_INSTANCE.web,
};

const MANIFEST_PREFIX = "dandisets/";
const ASSETS_MANIFEST = "assets.jsonld";
const DANDISET_MANIFEST = "dandiset.jsonld";

/** S3 caps a listing page at 1000 keys. */
const PAGE_SIZE = 1000;

/** A backstop, so a continuation token that never clears cannot spin forever. */
const MAX_LIST_PAGES = 200;

export interface BucketEntry {
  key: string;
  size: number;
}

interface ListingPage {
  entries: BucketEntry[];
  nextToken: string | null;
}

/** Reads one ListObjectsV2 response. */
export function parseListing(xml: string): ListingPage {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("The archive's bucket listing could not be parsed as XML.");
  }
  const entries: BucketEntry[] = [];
  for (const contents of Array.from(doc.getElementsByTagName("Contents"))) {
    const key = tagText(contents, "Key");
    if (!key) continue;
    entries.push({ key, size: Number(tagText(contents, "Size") ?? 0) || 0 });
  }
  return { entries, nextToken: tagText(doc, "NextContinuationToken") };
}

/** The listing is in S3's own namespace, which `getElementsByTagName` matches by qualified name. */
function tagText(parent: Document | Element, tag: string): string | null {
  return parent.getElementsByTagName(tag).item(0)?.textContent || null;
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`GET ${url} failed with HTTP ${resp.status}`);
  return resp.text();
}

/** Every object under `dandisets/` in the archive's bucket, read anonymously. */
export async function listManifestObjects(signal?: AbortSignal): Promise<BucketEntry[]> {
  const entries: BucketEntry[] = [];
  let token: string | null = null;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const params = new URLSearchParams({ "list-type": "2", prefix: MANIFEST_PREFIX, "max-keys": String(PAGE_SIZE) });
    if (token) params.set("continuation-token", token);
    const parsed = parseListing(await fetchText(`${EMBER_ARCHIVE.origin}/?${params.toString()}`, signal));
    entries.push(...parsed.entries);
    if (!parsed.nextToken) return entries;
    token = parsed.nextToken;
  }
  return entries;
}

/** One dataset in the browse list, however it was found. */
export interface ArchiveDandiset {
  /** Zero-padded dandiset identifier, e.g. `000265`. */
  id: string;
  /** The version whose manifests are read; always `draft` for an embargoed dataset. */
  version: string;
  /** Byte size of that version's `assets.jsonld`, or zero for an embargoed dataset, whose file
   * list comes from the API rather than a manifest. */
  manifestBytes: number;
  /** Whether the dataset is embargoed, and so listed through the API for its signed-in owner. */
  embargoed: boolean;
  /** Known up front only for an embargoed dataset, whose API listing carries its title. */
  name?: string;
}

/**
 * Which version of a dataset to read: `draft` wherever it exists, since it tracks what the dataset
 * holds now, else the newest published version (`0.<date>.<time>` sorts chronologically as text).
 */
export function pickManifestVersion(versions: readonly string[]): string | null {
  if (versions.includes("draft")) return "draft";
  return [...versions].sort().at(-1) ?? null;
}

/** Folds a bucket listing into one entry per dataset, ordered by identifier. */
export function indexDandisets(entries: readonly BucketEntry[]): ArchiveDandiset[] {
  const byId = new Map<string, Map<string, number>>();
  for (const { key, size } of entries) {
    const parts = key.split("/");
    if (parts.length !== 4 || parts[0] !== "dandisets" || parts[3] !== ASSETS_MANIFEST) continue;
    const versions = byId.get(parts[1]) ?? new Map<string, number>();
    versions.set(parts[2], size);
    byId.set(parts[1], versions);
  }
  const datasets: ArchiveDandiset[] = [];
  for (const [id, versions] of byId) {
    const version = pickManifestVersion([...versions.keys()]);
    if (version) datasets.push({ id, version, manifestBytes: versions.get(version) ?? 0, embargoed: false });
  }
  return datasets.sort((a, b) => a.id.localeCompare(b.id));
}

/** Merges the embargoed datasets a signed-in visitor owns into the (already API-filtered) public list. */
export function mergeDandisets(pub: readonly ArchiveDandiset[], owned: readonly ArchiveDandiset[]): ArchiveDandiset[] {
  const byId = new Map(pub.map((d) => [d.id, d]));
  for (const dataset of owned) byId.set(dataset.id, dataset);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function manifestUrl(dandiset: ArchiveDandiset, name: string): string {
  return `${EMBER_ARCHIVE.origin}/${MANIFEST_PREFIX}${dandiset.id}/${dandiset.version}/${name}`;
}

async function fetchManifest(url: string, signal?: AbortSignal): Promise<unknown> {
  return JSON.parse(await fetchText(url, signal)) as unknown;
}

/** A dataset's title, or null when its `dandiset.jsonld` cannot be read, so one unreadable title
 * leaves the rest of the list alone. */
export async function fetchDandisetName(dandiset: ArchiveDandiset, signal?: AbortSignal): Promise<string | null> {
  try {
    const doc = (await fetchManifest(manifestUrl(dandiset, DANDISET_MANIFEST), signal)) as { name?: unknown };
    return typeof doc.name === "string" && doc.name ? doc.name : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    console.warn(`Could not read the name of EMBER dandiset ${dandiset.id}:`, error);
    return null;
  }
}

/** A `.tsv` or `.csv` file in the archive. */
export interface ArchiveTable {
  dandisetId: string;
  /** Path within the dataset, e.g. `sub-01/ieeg/sub-01_electrodes.tsv`. */
  path: string;
  /** Bytes, or null when neither the manifest nor the API says. */
  size: number | null;
  /** The archive's own download endpoint for the asset. For an embargoed asset it is also where a
   * signed bucket URL is handed out, against the owner's token. */
  assetUrl: string;
  /** The public bucket URL the bytes are read from, or null for an embargoed asset. */
  downloadUrl: string | null;
  embargoed: boolean;
}

/** The file's own name, the last segment of its path. */
export function tableFileName(table: ArchiveTable): string {
  return table.path.split("/").pop() || table.path;
}

/** Why a listed table will not be loaded, or null when it can be: the limit a local file meets too. */
export function tableRefusal(table: ArchiveTable): string | null {
  return table.size !== null && table.size > MAX_TABLE_BYTES ? "This table is larger than the 20 MB limit." : null;
}

interface AssetManifestEntry {
  path?: unknown;
  contentSize?: unknown;
  contentUrl?: unknown;
}

/**
 * Every table in one parsed `assets.jsonld`. An asset lists both its API download endpoint and its
 * bucket object; the bucket one is read, picked by host rather than by position.
 */
export function selectTableAssets(dandisetId: string, manifest: unknown): ArchiveTable[] {
  if (!Array.isArray(manifest)) return [];
  const tables: ArchiveTable[] = [];
  for (const entry of manifest as unknown[]) {
    const raw = (entry ?? {}) as AssetManifestEntry;
    const path = typeof raw.path === "string" ? raw.path : "";
    if (!path || !isTableFileName(path)) continue;
    const urls = (Array.isArray(raw.contentUrl) ? raw.contentUrl : []).filter(
      (u): u is string => typeof u === "string",
    );
    const downloadUrl = urls.find((u) => isBucketUrl(u, EMBER_ARCHIVE.bucket));
    if (!downloadUrl) continue;
    tables.push({
      dandisetId,
      path,
      size: typeof raw.contentSize === "number" ? raw.contentSize : null,
      assetUrl: urls.find((u) => u !== downloadUrl) ?? downloadUrl,
      downloadUrl,
      embargoed: false,
    });
  }
  return tables.sort((a, b) => a.path.localeCompare(b.path));
}

function isBucketUrl(url: string, bucket: string): boolean {
  try {
    return new URL(url).hostname.startsWith(`${bucket}.s3.`);
  } catch {
    return false;
  }
}

/** Every table in one public dataset. */
export async function fetchDandisetTables(dandiset: ArchiveDandiset, signal?: AbortSignal): Promise<ArchiveTable[]> {
  return selectTableAssets(dandiset.id, await fetchManifest(manifestUrl(dandiset, ASSETS_MANIFEST), signal));
}

/**
 * How much `assets.jsonld` a whole-archive sweep may read. EMBER's public manifests came to about
 * 14 MB in October 2026; the listing reports every manifest's size, so whether that still holds is
 * measured on each visit rather than assumed.
 */
export const SWEEP_BUDGET_BYTES = 32 * 1024 * 1024;

/** Manifests read at once: small files on a bucket, so this is about being a considerate client. */
const SWEEP_CONCURRENCY = 8;

/** Extra attempts at one dataset's read before its failure is trusted, since a cold cache makes a
 * transient timeout far likelier than on a warm one. */
const SWEEP_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sweepBytes(datasets: readonly ArchiveDandiset[]): number {
  return datasets.reduce((total, d) => total + d.manifestBytes, 0);
}

export function canSweep(datasets: readonly ArchiveDandiset[]): boolean {
  return sweepBytes(datasets) <= SWEEP_BUDGET_BYTES;
}

/**
 * Reads every dataset's file list and reports the tables it holds, calling `onDataset` as each one
 * lands. A dataset whose list still cannot be read after the retries reports none rather than
 * failing the sweep, which is also how an embargoed dataset nobody here owns stays hidden.
 * `read` is passed in because a public dataset's list comes from the bucket and an embargoed one's
 * from the API.
 */
export async function sweepArchiveTables(
  datasets: readonly ArchiveDandiset[],
  read: (dandiset: ArchiveDandiset, signal?: AbortSignal) => Promise<ArchiveTable[]>,
  onDataset: (dandiset: ArchiveDandiset, tables: ArchiveTable[]) => void,
  signal?: AbortSignal,
  retryDelayMs: (attempt: number) => number = (attempt) => 300 * 2 ** attempt,
): Promise<void> {
  await runQueue(datasets, SWEEP_CONCURRENCY, async (dandiset) => {
    let tables: ArchiveTable[] = [];
    for (let attempt = 0; ; attempt++) {
      try {
        tables = await read(dandiset, signal);
        break;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (attempt >= SWEEP_RETRIES) {
          console.warn(`Could not read the file list of EMBER dandiset ${dandiset.id}:`, error);
          break;
        }
        await sleep(retryDelayMs(attempt));
      }
    }
    onDataset(dandiset, tables);
  });
}

/** Fills in the names of the datasets it is handed, calling `onName` as each one arrives. */
export async function hydrateDandisetNames(
  datasets: readonly ArchiveDandiset[],
  onName: (dandiset: ArchiveDandiset, name: string | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  await runQueue(datasets, SWEEP_CONCURRENCY, async (dandiset) => {
    onName(dandiset, await fetchDandisetName(dandiset, signal));
  });
}

/** The dataset's own page in the archive's web UI. */
export function dandisetWebUrl(dandiset: ArchiveDandiset): string {
  return `${EMBER_ARCHIVE.web}/dandiset/${dandiset.id}/${dandiset.version}`;
}
