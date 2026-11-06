// @vitest-environment jsdom
import { throwingStorage } from "@brain-bbqs/test-utils/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCachedNames, saveCachedNames } from "../../src/lib/archiveNames";

const KEY = "ember-rave-visualizer.archive-names.v1";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the dataset name cache", () => {
  it("round-trips the titles it is given", () => {
    saveCachedNames(new Map([["000001", "One"]]), 1_000);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual({ savedAt: 1_000, names: { "000001": "One" } });
    expect([...loadCachedNames(1_000 + DAY)]).toEqual([["000001", "One"]]);
  });

  it("forgets titles older than two weeks", () => {
    saveCachedNames(new Map([["000001", "One"]]), 0);
    expect(loadCachedNames(15 * DAY).size).toBe(0);
  });

  it.each([
    ["nothing stored", null],
    ["no timestamp", JSON.stringify({ names: { a: "b" } })],
    ["no names", JSON.stringify({ savedAt: Date.now() })],
  ])("holds nothing with %s", (_, raw) => {
    if (raw) localStorage.setItem(KEY, raw);
    expect(loadCachedNames().size).toBe(0);
  });

  it("reads a corrupted cache as empty, with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.setItem(KEY, "{not json");
    expect(loadCachedNames().size).toBe(0);
    expect(warn).toHaveBeenCalledWith("Could not read the cached dataset names:", expect.any(Error));
  });

  it("warns rather than throws when storage refuses the write", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const restore = throwingStorage();
    try {
      saveCachedNames(new Map([["000001", "One"]]));
    } finally {
      restore();
    }
    expect(warn).toHaveBeenCalledWith("Could not cache the dataset names:", expect.any(Error));
  });
});
