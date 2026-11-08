// @vitest-environment jsdom
import { jsonResponse, routeFetch, textResponse } from "@brain-bbqs/test-utils/vitest";
import { resolveConfig } from "@brain-bbqs/ember-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArchiveTable } from "../../src/lib/archives";
import {
  downloadEmbargoedTable,
  listEmbargoedTables,
  listOwnedEmbargoedDandisets,
  listPublicDandisetIds,
} from "../../src/lib/embargoed";

const API = "https://api-dandi.emberarchive.org/api";
const cfg = resolveConfig({ dandisetId: "", oauthAccessToken: "tok" });

function authOf(init?: RequestInit): string | null {
  return new Headers(init?.headers).get("Authorization");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listPublicDandisetIds", () => {
  it("collects every identifier across pages, calling anonymously even when signed in", async () => {
    const fetchMock = routeFetch([
      {
        match: "page=2",
        respond: () => jsonResponse({ results: [{ identifier: "000003" }], next: null }),
      },
      {
        match: `${API}/dandisets/?page_size=1000`,
        respond: () =>
          jsonResponse({
            results: [{ identifier: "000001" }, { identifier: "000002" }],
            next: `${API}/dandisets/?page=2&page_size=1000`,
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    expect([...(await listPublicDandisetIds(cfg))]).toEqual(["000001", "000002", "000003"]);
    for (const call of fetchMock.calls) expect(authOf(call.init)).toBeNull();
  });

  it("stops rather than following a next page pointing at another host, and survives an empty body", async () => {
    const fetchMock = routeFetch([
      { match: API, respond: () => jsonResponse({ next: "https://elsewhere.example/api/dandisets/?page=2" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    expect((await listPublicDandisetIds(cfg)).size).toBe(0);
    expect(fetchMock.calls.length).toBe(1);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", routeFetch([]));
    await expect(listPublicDandisetIds(cfg, controller.signal)).rejects.toThrow(/cancelled/);
  });
});

describe("listOwnedEmbargoedDandisets", () => {
  const owned = `${API}/dandisets/?user=me&embargoed=true&page_size=1000`;

  it("keeps only the embargoed ones the visitor is listed against, ordered by identifier", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = routeFetch([
      {
        match: owned,
        respond: () =>
          jsonResponse({
            results: [
              { identifier: "000009", embargo_status: "EMBARGOED", draft_version: { name: "Nine" } },
              { identifier: "000004", embargo_status: "EMBARGOED", draft_version: { name: "Four" } },
              { identifier: "000005", embargo_status: "EMBARGOED" },
              { identifier: "000006", embargo_status: "EMBARGOED" },
              { identifier: "000007", embargo_status: "OPEN" },
            ],
          }),
      },
      { match: "/000009/users/", respond: () => jsonResponse([{ username: "ada" }]) },
      { match: "/000004/users/", respond: () => jsonResponse([{ username: "ada" }, { username: "bob" }]) },
      { match: "/000005/users/", respond: () => jsonResponse([{ username: "bob" }]) },
      { match: "/000006/users/", respond: () => textResponse("nope", 500) },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await listOwnedEmbargoedDandisets(cfg, "ada")).toEqual([
      { id: "000004", version: "draft", manifestBytes: 0, embargoed: true, name: "Four" },
      { id: "000009", version: "draft", manifestBytes: 0, embargoed: true, name: "Nine" },
    ]);
    for (const call of fetchMock.calls) expect(authOf(call.init)).toBe("Bearer tok");
  });

  it("offers nothing when there is no account to check against", async () => {
    const fetchMock = routeFetch([]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await listOwnedEmbargoedDandisets(cfg, "")).toEqual([]);
    expect(fetchMock.calls).toEqual([]);
  });

  it("has nothing to offer when the archive answers with no body", async () => {
    vi.stubGlobal("fetch", routeFetch([{ match: owned, respond: () => new Response(null, { status: 204 }) }]));
    expect(await listOwnedEmbargoedDandisets(cfg, "ada")).toEqual([]);
  });

  it("reads an owner list that comes back empty as not yours", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        {
          match: owned,
          respond: () => jsonResponse({ results: [{ identifier: "000001", embargo_status: "EMBARGOED" }] }),
        },
        { match: "/users/", respond: () => new Response(null, { status: 204 }) },
      ]),
    );
    expect(await listOwnedEmbargoedDandisets(cfg, "ada")).toEqual([]);
  });
});

describe("listEmbargoedTables", () => {
  const first = `${API}/dandisets/000004/versions/draft/assets/?metadata=false&page_size=1000`;

  it("keeps the tables out of the API's asset listing, following its pages", async () => {
    const fetchMock = routeFetch([
      {
        match: "page=2",
        respond: () => jsonResponse({ results: [{ asset_id: "a2", path: "b/electrodes.csv" }], next: null }),
      },
      {
        match: first,
        respond: () =>
          jsonResponse({
            results: [
              { asset_id: "a1", path: "z/electrodes.tsv", size: 10 },
              { asset_id: "a3", path: "video.mp4", size: 10 },
              { path: "no-id.tsv" },
              { asset_id: "a4" },
            ],
            next: `${API}/dandisets/000004/versions/draft/assets/?page=2`,
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    expect(await listEmbargoedTables(cfg, "000004")).toEqual([
      {
        dandisetId: "000004",
        path: "b/electrodes.csv",
        size: null,
        assetUrl: `${API}/assets/a2/download/`,
        downloadUrl: null,
        embargoed: true,
      },
      {
        dandisetId: "000004",
        path: "z/electrodes.tsv",
        size: 10,
        assetUrl: `${API}/assets/a1/download/`,
        downloadUrl: null,
        embargoed: true,
      },
    ]);
  });

  it("reads an empty answer as no tables", async () => {
    vi.stubGlobal("fetch", routeFetch([{ match: first, respond: () => new Response(null, { status: 204 }) }]));
    expect(await listEmbargoedTables(cfg, "000004")).toEqual([]);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(listEmbargoedTables(cfg, "000004", controller.signal)).rejects.toThrow(/cancelled/);
  });
});

describe("downloadEmbargoedTable", () => {
  it("asks the archive's download endpoint for the bytes, with the owner's token", async () => {
    const assetUrl = `${API}/assets/a1/download/`;
    const fetchMock = routeFetch([{ match: assetUrl, respond: () => new Response("Electrode\tMNI152_x") }]);
    vi.stubGlobal("fetch", fetchMock);
    const embargoed: ArchiveTable = {
      dandisetId: "000004",
      path: "sub-01/sub-01_electrodes.tsv",
      size: 10,
      assetUrl,
      downloadUrl: null,
      embargoed: true,
    };
    const file = await downloadEmbargoedTable(cfg, embargoed);
    expect(file.name).toBe("sub-01_electrodes.tsv");
    expect(authOf(fetchMock.calls[0].init)).toBe("Bearer tok");
  });
});
