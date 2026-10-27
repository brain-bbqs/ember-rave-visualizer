// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MOCK_TABLE_NAME, readTestInjection, synthesizeMockTable } from "../../src/lib/testInjection";

describe("readTestInjection", () => {
  it("is null unless the explicit test gate is present", () => {
    expect(readTestInjection("")).toBeNull();
    expect(readTestInjection("?mock_table&fake_viewer&source_url")).toBeNull();
  });

  it("keeps a bare test gate as a no-op", () => {
    expect(readTestInjection("?test")).toEqual({
      mockTable: false,
      fakeViewer: false,
      sourceUrl: false,
    });
  });

  it("reads deterministic viewer and source flags", () => {
    expect(readTestInjection("?test&fake_viewer&source_url")).toEqual({
      mockTable: false,
      fakeViewer: true,
      sourceUrl: true,
    });
  });

  it("automatically pairs the mock table with the fake viewer", () => {
    expect(readTestInjection("?mock_table&test")).toEqual({
      mockTable: true,
      fakeViewer: true,
      sourceUrl: false,
    });
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
