// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { MOCK_CSV_NAME, readTestInjection, synthesizeMockCsv } from "../../src/lib/testInjection";

describe("readTestInjection", () => {
  it("is null unless the explicit test gate is present", () => {
    expect(readTestInjection("")).toBeNull();
    expect(readTestInjection("?mock_csv&fake_viewer&source_url")).toBeNull();
  });

  it("keeps a bare test gate as a no-op", () => {
    expect(readTestInjection("?test")).toEqual({
      mockCsv: false,
      fakeViewer: false,
      sourceUrl: false,
    });
  });

  it("reads deterministic viewer and source flags", () => {
    expect(readTestInjection("?test&fake_viewer&source_url")).toEqual({
      mockCsv: false,
      fakeViewer: true,
      sourceUrl: true,
    });
  });

  it("automatically pairs the mock CSV with the fake viewer", () => {
    expect(readTestInjection("?mock_csv&test")).toEqual({
      mockCsv: true,
      fakeViewer: true,
      sourceUrl: false,
    });
  });
});

describe("synthesizeMockCsv", () => {
  it("returns a fixed, valid, recognizably synthetic electrode table", async () => {
    const file = synthesizeMockCsv();
    expect(file.name).toBe(MOCK_CSV_NAME);
    expect(file.type).toBe("text/csv");
    expect(file.size).toBe(synthesizeMockCsv().size);
    if ("text" in file) {
      await expect(file.text()).resolves.toContain("MNI152_x");
    }
  });
});
