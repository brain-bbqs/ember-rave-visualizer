// A stubbed EMBER archive for routeFetch: its public bucket (listing and manifests) and the API's
// anonymous dandiset listing, the two reads the browse pane makes before anything else.
import { jsonResponse, textResponse, type FetchRoute } from "@brain-bbqs/test-utils/vitest";
import { EMBER_ARCHIVE } from "../../../src/lib/archives";

export const BUCKET = EMBER_ARCHIVE.origin;
export const API = "https://api-dandi.emberarchive.org/api";
export const OAUTH = "https://api-dandi.emberarchive.org/oauth";

export interface FakeDataset {
  id: string;
  name?: string;
  manifestBytes?: number;
  /** Table paths and sizes in its manifest; undefined for a manifest that cannot be read. */
  tables?: [string, number][];
}

export function listingXml(datasets: FakeDataset[]): string {
  const contents = datasets
    .map(
      (d) =>
        `<Contents><Key>dandisets/${d.id}/draft/assets.jsonld</Key><Size>${d.manifestBytes ?? 100}</Size></Contents>`,
    )
    .join("");
  return `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${contents}</ListBucketResult>`;
}

/** Where a fake dataset's table is read from, as its manifest lists it. */
export function bucketUrl(id: string, path: string): string {
  return `${BUCKET}/blobs/${id}/${path}`;
}

/** The bucket and the anonymous API listing for `datasets`, all public unless named in `notPublic`. */
export function archiveRoutes(datasets: FakeDataset[], notPublic: string[] = []): FetchRoute[] {
  return [
    { match: `${BUCKET}/?list-type=2`, respond: () => textResponse(listingXml(datasets)) },
    {
      match: `${API}/dandisets/?page_size=1000`,
      respond: () =>
        jsonResponse({ results: datasets.filter((d) => !notPublic.includes(d.id)).map((d) => ({ identifier: d.id })) }),
    },
    ...datasets.flatMap((d): FetchRoute[] => [
      {
        match: `${BUCKET}/dandisets/${d.id}/draft/dandiset.jsonld`,
        respond: () => (d.name ? jsonResponse({ name: d.name }) : textResponse("denied", 403)),
      },
      {
        match: `${BUCKET}/dandisets/${d.id}/draft/assets.jsonld`,
        respond: () =>
          d.tables
            ? jsonResponse(
                d.tables.map(([path, size]) => ({ path, contentSize: size, contentUrl: [bucketUrl(d.id, path)] })),
              )
            : textResponse("denied", 403),
      },
    ]),
  ];
}
