import {
  apiFetch,
  listedTitle,
  nextPagePath,
  type ArchiveConfig,
  type DandisetListResponse,
} from "@brain-bbqs/ember-client";
import { isTableFileName } from "./electrodeTable";
import { downloadTableFile } from "./remoteTable";
import { tableFileName, type ArchiveDandiset, type ArchiveTable } from "./archives";

// The half of the browse pane the public bucket cannot answer, as in clip-extractor's
// lib/embargoed.ts: what is actually public, which embargoed datasets a signed-in visitor owns,
// what tables are in one, and the bytes of a chosen table, all asked of the archive's API.

/** Pages read while listing every public dandiset before the walk gives up, at the page size below. */
const MAX_PUBLIC_LIST_PAGES = 50;
const PUBLIC_LIST_PAGE_SIZE = 1000;

/**
 * Every dandiset identifier the archive hands an anonymous caller: the authoritative set of what is
 * public. A dataset embargoed against everyone but its owner is listed in the bucket too, so a
 * bucket candidate is trusted only once its identifier turns up here.
 */
export async function listPublicDandisetIds(cfg: ArchiveConfig, signal?: AbortSignal): Promise<Set<string>> {
  const anonymous: ArchiveConfig = { ...cfg, accessToken: "" };
  const ids = new Set<string>();
  let path: string | null = `/dandisets/?page_size=${PUBLIC_LIST_PAGE_SIZE}`;
  for (let page = 0; path && page < MAX_PUBLIC_LIST_PAGES; page++) {
    if (signal?.aborted) throw new Error("Listing cancelled.");
    const body: DandisetListResponse = (await apiFetch<DandisetListResponse>(anonymous, path)) ?? {};
    for (const d of body.results ?? []) ids.add(d.identifier);
    path = nextPagePath(cfg, body.next);
  }
  return ids;
}

interface DandisetOwner {
  username?: string;
}

/**
 * Whether `username` is in the dandiset's own owner list. `?user=me` alone is not enough: a
 * superuser holds object permissions globally, so an EMBER admin would get every embargoed dataset.
 */
async function isListedOwner(cfg: ArchiveConfig, identifier: string, username: string): Promise<boolean> {
  const owners = await apiFetch<DandisetOwner[]>(cfg, `/dandisets/${identifier}/users/`);
  return (owners ?? []).some((owner) => owner.username === username);
}

/**
 * The embargoed datasets `username` owns. Fails closed throughout: with no username, and for any
 * dataset whose owner list cannot be read, nothing is offered.
 */
export async function listOwnedEmbargoedDandisets(cfg: ArchiveConfig, username: string): Promise<ArchiveDandiset[]> {
  if (!username) return [];
  const resp = await apiFetch<DandisetListResponse>(cfg, "/dandisets/?user=me&embargoed=true&page_size=1000");
  const candidates = (resp?.results ?? [])
    .filter((d) => d.embargo_status === "EMBARGOED")
    .map((d) => ({ id: d.identifier, version: "draft", manifestBytes: 0, embargoed: true, name: listedTitle(d) }));

  const owned = await Promise.all(
    candidates.map((d) =>
      isListedOwner(cfg, d.id, username).catch((error: unknown) => {
        console.warn(`Could not read the owners of dandiset ${d.id}:`, error);
        return false;
      }),
    ),
  );
  return candidates.filter((_, i) => owned[i]).sort((a, b) => a.id.localeCompare(b.id));
}

interface AssetListItem {
  asset_id?: string;
  path?: string;
  size?: number;
}

interface AssetListResponse {
  results?: AssetListItem[];
  next?: string | null;
}

const MAX_ASSET_PAGES = 20;
const ASSET_PAGE_SIZE = 1000;

/** Every table in one embargoed dataset's draft, from the API's asset listing. */
export async function listEmbargoedTables(
  cfg: ArchiveConfig,
  dandisetId: string,
  signal?: AbortSignal,
): Promise<ArchiveTable[]> {
  const tables: ArchiveTable[] = [];
  let path: string | null =
    `/dandisets/${dandisetId}/versions/draft/assets/?metadata=false&page_size=${ASSET_PAGE_SIZE}`;
  for (let page = 0; path && page < MAX_ASSET_PAGES; page++) {
    if (signal?.aborted) throw new Error("Listing cancelled.");
    const body: AssetListResponse = (await apiFetch<AssetListResponse>(cfg, path)) ?? {};
    for (const asset of body.results ?? []) {
      if (!asset.asset_id || !asset.path || !isTableFileName(asset.path)) continue;
      tables.push({
        dandisetId,
        path: asset.path,
        size: typeof asset.size === "number" ? asset.size : null,
        assetUrl: `${cfg.api}/assets/${asset.asset_id}/download/`,
        downloadUrl: null,
        embargoed: true,
      });
    }
    path = nextPagePath(cfg, body.next);
  }
  return tables.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Downloads an embargoed table. The archive answers its download endpoint with a redirect to a
 * short-lived signed bucket URL; the browser follows it and drops the `Authorization` header at that
 * cross-origin hop, so the token only ever reaches the API that issued it.
 */
export function downloadEmbargoedTable(cfg: ArchiveConfig, table: ArchiveTable, signal?: AbortSignal): Promise<File> {
  return downloadTableFile(table.assetUrl, tableFileName(table), {
    signal,
    headers: { Authorization: `Bearer ${cfg.accessToken}` },
  });
}
