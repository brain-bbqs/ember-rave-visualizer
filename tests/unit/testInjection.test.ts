import { describe, expect, it } from "vitest";
import { MOCK_FILE_NAME, readTestInjection, synthesizeMockFile } from "../../src/lib/testInjection";

describe("readTestInjection", () => {
  it("is null without ?test, however many other params are present", () => {
    expect(readTestInjection("")).toBe(null);
    expect(readTestInjection("?mock_file")).toBe(null);
    expect(readTestInjection("?foo=1&bar")).toBe(null);
  });

  it("is a no-op plan for a bare ?test", () => {
    expect(readTestInjection("?test")).toEqual({ mockFile: false });
  });

  it("reads the mock_file flag", () => {
    expect(readTestInjection("?test&mock_file")).toEqual({ mockFile: true });
    expect(readTestInjection("?mock_file&test")).toEqual({ mockFile: true });
  });
});

describe("synthesizeMockFile", () => {
  it("is a fixed, recognizably fake file", () => {
    const file = synthesizeMockFile();
    expect(file.name).toBe(MOCK_FILE_NAME);
    expect(file.name).toContain("test-injection");
    expect(file.type).toBe("text/plain");
    expect(file.size).toBe(12_345);
    // Fixed, so every snapshot of the loaded state comes out alike.
    expect(synthesizeMockFile().size).toBe(file.size);
  });
});
