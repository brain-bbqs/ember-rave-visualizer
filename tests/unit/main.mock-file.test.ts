// @vitest-environment jsdom
// Boots the real app under the `?test&mock_file` injection: the page should land straight on the
// loaded-file state, without a picker interaction, the way the Chromatic snapshot reaches it.
import { beforeAll, describe, expect, it } from "vitest";
import { MOCK_FILE_NAME } from "../../src/lib/testInjection";
import { bootMain, el } from "./helpers/mainHarness";

beforeAll(async () => {
  await bootMain("?test&mock_file");
});

describe("main.ts boot with ?test&mock_file", () => {
  it("opens on the loaded-file card, naming the mock", () => {
    expect(el("file-card").hidden).toBe(false);
    expect(el("load-card").hidden).toBe(true);
    expect(el("file-summary-name").textContent).toBe(MOCK_FILE_NAME);
    expect(el("file-summary-stats").textContent).toBe("12 KB · text/plain");
  });

  it("still lets Change file return to the picker", () => {
    el("change-file-btn").click();
    expect(el("file-card").hidden).toBe(true);
    expect(el("load-card").hidden).toBe(false);
  });
});
