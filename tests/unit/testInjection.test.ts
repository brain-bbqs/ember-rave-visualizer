// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  fakeArchiveBrowse,
  MOCK_TABLE_NAME,
  readTestInjection,
  synthesizeMockTable,
  type TestInjection,
} from "../../src/lib/testInjection";

const OFF: TestInjection = {
  mockTable: false,
  fakeViewer: false,
  sourceUrl: false,
  sourceEmber: false,
  remoteListing: null,
  signedIn: false,
  signedOut: false,
};

describe("readTestInjection", () => {
  it("is null unless the explicit test gate is present", () => {
    expect(readTestInjection("")).toBeNull();
    expect(readTestInjection("?mock_table&fake_viewer&source_url&signed_in")).toBeNull();
  });

  it("keeps a bare test gate as a no-op", () => {
    expect(readTestInjection("?test")).toEqual(OFF);
  });

  it("reads deterministic viewer and source flags", () => {
    expect(readTestInjection("?test&fake_viewer&source_url")).toEqual({ ...OFF, fakeViewer: true, sourceUrl: true });
    expect(readTestInjection("?test&source_ember")).toEqual({ ...OFF, sourceEmber: true });
  });

  it("automatically pairs the mock table with the fake viewer", () => {
    expect(readTestInjection("?mock_table&test")).toEqual({ ...OFF, mockTable: true, fakeViewer: true });
  });

  it.each([
    ["remote_listing=7", 7],
    ["remote_listing=0", 0],
    ["remote_listing", 6],
    ["remote_listing=many", 6],
    ["remote_listing=-2", 6],
    ["remote_listing=5000", 200],
  ])("reads %s as a fake listing of %d tables, opening the EMBER pane", (param, count) => {
    expect(readTestInjection(`?test&${param}`)).toEqual({ ...OFF, remoteListing: count, sourceEmber: true });
  });

  it("fakes a sign-in, unless asked to look signed out", () => {
    expect(readTestInjection("?test&signed_in")).toEqual({ ...OFF, signedIn: true });
    expect(readTestInjection("?test&signed_in&signed_out")).toEqual({ ...OFF, signedOut: true });
  });
});

describe("synthesizeMockTable", () => {
  it("returns a fixed, valid, recognizably synthetic electrode table", async () => {
    const file = synthesizeMockTable();
    expect(file.name).toBe(MOCK_TABLE_NAME);
    expect(file.type).toBe("text/tab-separated-values");
    expect(file.size).toBe(synthesizeMockTable().size);
    if ("text" in file) {
      await expect(file.text()).resolves.toContain("MNI152_x");
    }
  });
});

describe("fakeArchiveBrowse", () => {
  it("spreads the tables three to a fake dataset, all public while signed out", () => {
    const { datasets, tables } = fakeArchiveBrowse(7, false);
    expect(datasets.map((d) => [d.id, d.name, d.embargoed])).toEqual([
      ["214000", "Test dataset 1", false],
      ["214001", "Test dataset 2", false],
      ["214002", "Test dataset 3", false],
    ]);
    expect([...tables.values()].map((list) => list.length)).toEqual([3, 3, 1]);
    const first = tables.get("214000")?.[0];
    expect(first).toEqual({
      dandisetId: "214000",
      path: "sub-01/ieeg/sub-01_electrodes.tsv",
      size: 2048,
      assetUrl: "https://test-injection.invalid/214000/sub-01_electrodes.tsv",
      downloadUrl: "https://test-injection.invalid/214000/sub-01_electrodes.tsv",
      embargoed: false,
    });
  });

  it("marks the last dataset embargoed, with no public download, when signed in", () => {
    const { datasets, tables } = fakeArchiveBrowse(4, true);
    expect(datasets.map((d) => d.embargoed)).toEqual([false, true]);
    expect(tables.get("214001")?.[0]).toMatchObject({ embargoed: true, downloadUrl: null });
  });

  it("still names one empty dataset for an empty listing", () => {
    const { datasets, tables } = fakeArchiveBrowse(0, false);
    expect(datasets.length).toBe(1);
    expect(tables.get("214000")).toEqual([]);
  });
});
