// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MOCK_CSV_NAME } from "../../src/lib/testInjection";
import { bootMain, el } from "./helpers/mainHarness";

beforeAll(async () => {
  await bootMain("?test&mock_csv");
});

describe("main.ts boot with ?test&mock_csv", () => {
  it("loads a fixed CSV through the real validation path and fake viewer", async () => {
    await vi.waitFor(() => expect(el("load-status").textContent).toContain(MOCK_CSV_NAME + " loaded"));
    expect(el("load-status").textContent).toContain("2 electrodes · 7 columns · Local file");
    expect(el("viewer-test-placeholder").hidden).toBe(false);
    expect(el("clear-electrodes-btn").hidden).toBe(false);
  });

  it("can remove the injected electrodes", () => {
    el("clear-electrodes-btn").click();
    expect(el("load-status").hidden).toBe(true);
  });
});
