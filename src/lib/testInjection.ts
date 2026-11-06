import type { ArchiveDandiset, ArchiveTable } from "./archives";

export interface TestInjection {
  mockTable: boolean;
  fakeViewer: boolean;
  sourceUrl: boolean;
  /** Opens the Browse EMBER pane. Implied by `remoteListing`. */
  sourceEmber: boolean;
  /** Fakes the browse pane's whole listing with this many tables, bypassing the bucket and the API.
   * Null when `remote_listing` was not given. */
  remoteListing: number | null;
  /** Renders the header as a fake account would, with no token and no call to the archive. */
  signedIn: boolean;
  /** Renders every surface as signed out, leaving any real stored sign-in untouched. Wins over
   * `signedIn`, since looking signed out is the more conservative of the two. */
  signedOut: boolean;
}

const DEFAULT_REMOTE_LISTING = 6;
const MAX_REMOTE_LISTING = 200;

function listingCount(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, MAX_REMOTE_LISTING) : DEFAULT_REMOTE_LISTING;
}

export function readTestInjection(search: string): TestInjection | null {
  const params = new URLSearchParams(search);
  if (!params.has("test")) return null;
  const mockTable = params.has("mock_table");
  const remoteListing = params.has("remote_listing") ? listingCount(params.get("remote_listing")) : null;
  const signedOut = params.has("signed_out");
  return {
    mockTable,
    fakeViewer: mockTable || params.has("fake_viewer"),
    sourceUrl: params.has("source_url"),
    sourceEmber: params.has("source_ember") || remoteListing !== null,
    remoteListing,
    signedIn: !signedOut && params.has("signed_in"),
    signedOut,
  };
}

export const MOCK_TABLE_NAME = "test-injection-mock-electrodes.tsv";

export function synthesizeMockTable(): File {
  const table = [
    "Electrode\tMNI152_x\tMNI152_y\tMNI152_z\tLabel\tGroup\tRadius",
    "1\t-28.23\t15.38\t-39.43\tTEST-A1\tTEST-A\t1",
    "2\t-33.50\t16.10\t-36.69\tTEST-A2\tTEST-A\t1",
  ].join("\n");
  return new File([table], MOCK_TABLE_NAME, { type: "text/tab-separated-values" });
}

/** The account a faked sign-in shows in the header. */
export const FAKE_ACCOUNT = { username: "test-user", name: "Live Smoketest" };

/** Six digits like a real dandiset id, far above EMBER's sequential range, so nothing collides. */
const FAKE_DANDISET_ID_BASE = 214_000;
const FAKE_TABLES_PER_DATASET = 3;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Fakes the browse pane's listing: `n` tables, `FAKE_TABLES_PER_DATASET` to a fake dataset, with
 * the last dataset embargoed when the page reads as signed in. The URLs resolve nowhere real, so
 * picking one ends in the ordinary download refusal, a truthful answer for a file this module made up.
 */
export function fakeArchiveBrowse(
  n: number,
  signedIn: boolean,
): { datasets: ArchiveDandiset[]; tables: Map<string, ArchiveTable[]> } {
  const datasetCount = Math.max(1, Math.ceil(n / FAKE_TABLES_PER_DATASET));
  const datasets: ArchiveDandiset[] = [];
  const tables = new Map<string, ArchiveTable[]>();
  let remaining = n;
  for (let d = 0; d < datasetCount; d++) {
    const id = String(FAKE_DANDISET_ID_BASE + d);
    const embargoed = signedIn && d === datasetCount - 1;
    const count = Math.min(FAKE_TABLES_PER_DATASET, remaining);
    remaining -= count;
    const list = Array.from({ length: count }, (_, i): ArchiveTable => {
      const subject = `sub-${pad2(d * FAKE_TABLES_PER_DATASET + i + 1)}`;
      const url = `https://test-injection.invalid/${id}/${subject}_electrodes.tsv`;
      return {
        dandisetId: id,
        path: `${subject}/ieeg/${subject}_electrodes.tsv`,
        size: 2_048 + i * 512,
        assetUrl: url,
        downloadUrl: embargoed ? null : url,
        embargoed,
      };
    });
    tables.set(id, list);
    datasets.push({ id, version: "draft", manifestBytes: 4_096, embargoed, name: `Test dataset ${d + 1}` });
  }
  return { datasets, tables };
}
