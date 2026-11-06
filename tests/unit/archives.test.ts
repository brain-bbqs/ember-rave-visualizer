// @vitest-environment jsdom
import { jsonResponse, routeFetch, textResponse } from "@brain-bbqs/test-utils/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canSweep,
  dandisetWebUrl,
  EMBER_ARCHIVE,
  fetchDandisetName,
  fetchDandisetTables,
  hydrateDandisetNames,
  indexDandisets,
  listManifestObjects,
  mergeDandisets,
  parseListing,
  pickManifestVersion,
  selectTableAssets,
  sweepArchiveTables,
  sweepBytes,
  SWEEP_BUDGET_BYTES,
  tableFileName,
  tableRefusal,
  type ArchiveDandiset,
  type ArchiveTable,
} from "../../src/lib/archives";
import { MAX_TABLE_BYTES } from "../../src/lib/electrodeTable";

const BUCKET = EMBER_ARCHIVE.origin;
const API = "https://api-dandi.emberarchive.org/api";

function listingXml(keys: [string, number][], nextToken?: string): string {
  const contents = keys.map(([key, size]) => `<Contents><Key>${key}</Key><Size>${size}</Size></Contents>`).join("");
  const next = nextToken ? `<NextContinuationToken>${nextToken}</NextContinuationToken>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${next}${contents}</ListBucketResult>`;
}

function dandiset(id: string, manifestBytes = 1234, version = "draft"): ArchiveDandiset {
  return { id, version, manifestBytes, embargoed: false };
}

function table(path: string, size: number | null): ArchiveTable {
  return { dandisetId: "000001", path, size, assetUrl: "a", downloadUrl: "d", embargoed: false };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseListing", () => {
  it("reads keys, sizes and the continuation token out of an S3 listing", () => {
    const page = parseListing(listingXml([["dandisets/000265/draft/assets.jsonld", 4096]], "tok"));
    expect(page.entries).toEqual([{ key: "dandisets/000265/draft/assets.jsonld", size: 4096 }]);
    expect(page.nextToken).toBe("tok");
  });

  it("skips an entry with no key and reads a missing or unreadable size as zero", () => {
    const xml =
      '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Contents><Size>9</Size></Contents>' +
      "<Contents><Key>a</Key></Contents><Contents><Key>b</Key><Size>x</Size></Contents></ListBucketResult>";
    expect(parseListing(xml)).toEqual({
      entries: [
        { key: "a", size: 0 },
        { key: "b", size: 0 },
      ],
      nextToken: null,
    });
  });

  it("refuses a body that is not XML at all", () => {
    expect(() => parseListing("<<not xml")).toThrow(/could not be parsed/);
  });
});

describe("pickManifestVersion", () => {
  it.each([
    [["0.250101.0000", "draft"], "draft"],
    [["0.250101.0000", "0.260101.0000"], "0.260101.0000"],
    [[], null],
  ])("picks from %j", (versions, expected) => {
    expect(pickManifestVersion(versions)).toBe(expected);
  });
});

describe("indexDandisets", () => {
  it("folds a listing into one entry per dataset, carrying that version's manifest size", () => {
    const datasets = indexDandisets([
      { key: "dandisets/000002/draft/assets.jsonld", size: 20 },
      { key: "dandisets/000001/0.250101.0000/assets.jsonld", size: 5 },
      { key: "dandisets/000001/0.260101.0000/assets.jsonld", size: 7 },
      { key: "dandisets/000002/draft/dandiset.jsonld", size: 3 },
      { key: "dandisets/000002/0.250101.0000/assets.jsonld", size: 9 },
      { key: "other/000003/draft/assets.jsonld", size: 1 },
    ]);
    expect(datasets).toEqual([dandiset("000001", 7, "0.260101.0000"), dandiset("000002", 20)]);
  });
});

describe("mergeDandisets", () => {
  it("lists public and owned datasets together by identifier, the owned entry winning", () => {
    const owned: ArchiveDandiset = { ...dandiset("000002", 0), embargoed: true, name: "Mine" };
    expect(mergeDandisets([dandiset("000003"), dandiset("000002")], [owned])).toEqual([owned, dandiset("000003")]);
  });
});

describe("selectTableAssets", () => {
  const bucketUrl = `${BUCKET}/blobs/54e/5fa/54e5faf4-c8d1-48b9-975d-43d6b6ab56ed`;
  const apiUrl = `${API}/assets/583f066b/download/`;

  it("keeps only tables, read from the bucket and cited by the archive's own URL", () => {
    const manifest = [
      { path: "sub-01/ieeg/sub-01_electrodes.tsv", contentSize: 4398, contentUrl: [apiUrl, bucketUrl] },
      { path: "a.csv", contentUrl: [bucketUrl] },
      { path: "video.mp4", contentSize: 1, contentUrl: [apiUrl, bucketUrl] },
      { path: "elsewhere.tsv", contentUrl: ["https://example.org/elsewhere.tsv", "not a url", 7] },
      { contentUrl: [bucketUrl] },
      null,
    ];
    expect(selectTableAssets("000564", manifest)).toEqual([
      {
        dandisetId: "000564",
        path: "a.csv",
        size: null,
        assetUrl: bucketUrl,
        downloadUrl: bucketUrl,
        embargoed: false,
      },
      {
        dandisetId: "000564",
        path: "sub-01/ieeg/sub-01_electrodes.tsv",
        size: 4398,
        assetUrl: apiUrl,
        downloadUrl: bucketUrl,
        embargoed: false,
      },
    ]);
  });

  it("survives a manifest that is not a list of assets", () => {
    expect(selectTableAssets("000564", { not: "a list" })).toEqual([]);
  });
});

describe("tableFileName and tableRefusal", () => {
  it("names a table by the last segment of its path", () => {
    expect(tableFileName(table("sub-01/ieeg/sub-01_electrodes.tsv", 1))).toBe("sub-01_electrodes.tsv");
    expect(tableFileName(table("dir/", 1))).toBe("dir/");
  });

  it("refuses only a table known to be over the size limit", () => {
    expect(tableRefusal(table("a.tsv", MAX_TABLE_BYTES + 1))).toMatch(/20 MB/);
    expect(tableRefusal(table("a.tsv", MAX_TABLE_BYTES))).toBeNull();
    expect(tableRefusal(table("a.tsv", null))).toBeNull();
  });
});

describe("sweep affordability", () => {
  it("adds up what reading every manifest would cost, against the budget", () => {
    const small = [dandiset("1", 10), dandiset("2", 20)];
    expect(sweepBytes(small)).toBe(30);
    expect(canSweep(small)).toBe(true);
    expect(canSweep([dandiset("1", SWEEP_BUDGET_BYTES + 1)])).toBe(false);
  });
});

describe("listManifestObjects", () => {
  it("follows continuation tokens until the listing runs out", async () => {
    const fetchMock = routeFetch([
      {
        match: "continuation-token=tok",
        respond: () => textResponse(listingXml([["dandisets/000002/draft/assets.jsonld", 2]])),
      },
      {
        match: `${BUCKET}/?list-type=2`,
        respond: () => textResponse(listingXml([["dandisets/000001/draft/assets.jsonld", 1]], "tok")),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await listManifestObjects()).toEqual([
      { key: "dandisets/000001/draft/assets.jsonld", size: 1 },
      { key: "dandisets/000002/draft/assets.jsonld", size: 2 },
    ]);
    expect(fetchMock.calls[0].url).toBe(`${BUCKET}/?list-type=2&prefix=dandisets%2F&max-keys=1000`);
  });

  it("gives up after its page backstop when the token never clears", async () => {
    const fetchMock = routeFetch([{ match: BUCKET, respond: () => textResponse(listingXml([], "again")) }]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await listManifestObjects()).toEqual([]);
    expect(fetchMock.calls.length).toBe(200);
  });

  it("reports an unreachable bucket rather than returning an empty archive", async () => {
    vi.stubGlobal("fetch", routeFetch([{ match: BUCKET, respond: () => textResponse("denied", 403) }]));
    await expect(listManifestObjects()).rejects.toThrow(/HTTP 403/);
  });
});

describe("reading a dataset's manifests", () => {
  it("reads a dataset's title from the version it indexed", async () => {
    const fetchMock = routeFetch([
      { match: `${BUCKET}/dandisets/000001/draft/dandiset.jsonld`, respond: () => jsonResponse({ name: "Title" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchDandisetName(dandiset("000001"))).toBe("Title");
  });

  it.each([
    ["an unreadable manifest", () => textResponse("denied", 403)],
    ["a manifest with no name", () => jsonResponse({ name: "" })],
  ])("leaves a dataset unnamed for %s", async (_, respond) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", routeFetch([{ match: BUCKET, respond }]));
    expect(await fetchDandisetName(dandiset("000001"))).toBeNull();
  });

  it("passes an abort through rather than reading it as a missing name", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", routeFetch([]));
    await expect(fetchDandisetName(dandiset("000001"), controller.signal)).rejects.toThrow();
  });

  it("reads the tables in a dataset out of its asset manifest", async () => {
    const bucketUrl = `${BUCKET}/blobs/x`;
    vi.stubGlobal(
      "fetch",
      routeFetch([
        {
          match: `${BUCKET}/dandisets/000001/draft/assets.jsonld`,
          respond: () => jsonResponse([{ path: "e.tsv", contentSize: 3, contentUrl: [bucketUrl] }]),
        },
      ]),
    );
    expect(await fetchDandisetTables(dandiset("000001"))).toEqual([
      { dandisetId: "000001", path: "e.tsv", size: 3, assetUrl: bucketUrl, downloadUrl: bucketUrl, embargoed: false },
    ]);
  });
});

describe("sweepArchiveTables", () => {
  const noDelay = () => 0;

  it("reports every dataset, retrying a failed read before trusting it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let flaky = 0;
    const read = vi.fn(async (d: ArchiveDandiset) => {
      if (d.id === "broken") throw new Error("always");
      if (d.id === "flaky" && flaky++ < 2) throw new Error("once");
      return [table(`${d.id}.tsv`, 1)];
    });
    const seen: [string, number][] = [];
    await sweepArchiveTables(
      [dandiset("ok"), dandiset("flaky"), dandiset("broken")],
      read,
      (d, tables) => seen.push([d.id, tables.length]),
      undefined,
      noDelay,
    );
    expect(seen.sort()).toEqual([
      ["broken", 0],
      ["flaky", 1],
      ["ok", 1],
    ]);
    expect(read.mock.calls.filter(([d]) => d.id === "broken").length).toBe(3);
  });

  it("stops at once when the sweep is cancelled", async () => {
    const controller = new AbortController();
    const read = vi.fn(async () => {
      controller.abort();
      throw new Error("aborted");
    });
    await expect(sweepArchiveTables([dandiset("1")], read, vi.fn(), controller.signal, noDelay)).rejects.toThrow(
      "aborted",
    );
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("waits longer before each retry by default", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const read = vi.fn(async () => Promise.reject(new Error("no")));
      const done = sweepArchiveTables([dandiset("1")], read, vi.fn());
      await vi.advanceTimersByTimeAsync(299);
      expect(read).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(read).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(600);
      await done;
      expect(read).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("hydrateDandisetNames", () => {
  it("reports each dataset's name as it arrives", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      routeFetch([{ match: "/000001/draft/dandiset.jsonld", respond: () => jsonResponse({ name: "One" }) }]),
    );
    const names: [string, string | null][] = [];
    await hydrateDandisetNames([dandiset("000001"), dandiset("000002")], (d, name) => names.push([d.id, name]));
    expect(names.sort()).toEqual([
      ["000001", "One"],
      ["000002", null],
    ]);
  });
});

describe("dandisetWebUrl", () => {
  it("points at the dataset's own page in the archive", () => {
    expect(dandisetWebUrl(dandiset("000123", 1, "0.250101.0000"))).toBe(
      "https://dandi.emberarchive.org/dandiset/000123/0.250101.0000",
    );
  });
});
