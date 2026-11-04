// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { throwingStorage } from "@brain-bbqs/test-utils/vitest";
import { countChangelogVersions } from "@brain-bbqs/ui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { THEME_KEY } from "../../src/lib/settings";
import { bootMain, el, pickFile } from "./helpers/mainHarness";

const HEADER = "Electrode,MNI152_x,MNI152_y,MNI152_z,Label";
const WHATS_NEW_RECENT_VERSIONS = 3;

beforeAll(async () => {
  await bootMain("?test&fake_viewer");
});

describe("main.ts boot", () => {
  it("stamps the version and renders the deterministic viewer shell", () => {
    expect(el("version-indicator").textContent).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(el("load-card").hidden).toBe(false);
    expect(el("viewer-card").hidden).toBe(false);
    expect(el("viewer-frame").hidden).toBe(true);
    expect(el("viewer-loading").hidden).toBe(true);
    expect(el("viewer-test-placeholder").hidden).toBe(false);
    expect(el("load-status").hidden).toBe(true);
  });

  it("switches between local and remote URL sources", () => {
    el("source-url-btn").click();
    expect(el("local-source-pane").hidden).toBe(true);
    expect(el("url-source-pane").hidden).toBe(false);
    el("source-local-btn").click();
    expect(el("local-source-pane").hidden).toBe(false);
    expect(el("url-source-pane").hidden).toBe(true);
  });

  it("validates and loads a local electrode CSV, then removes it", async () => {
    const body = HEADER + "\n1,1,2,3,A1\n2,4,5,6,A2";
    pickFile(new File([body], "subject.csv", { type: "text/csv" }));
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("subject.csv loaded"));
    expect(el("load-status").textContent).toContain("2 electrodes · 5 columns · Local file");
    expect(el("clear-electrodes-btn").hidden).toBe(false);

    el("clear-electrodes-btn").click();
    expect(el("load-status").hidden).toBe(true);
    expect(el("clear-electrodes-btn").hidden).toBe(true);
  });

  it("shows a useful validation error for an invalid CSV", async () => {
    pickFile(new File(["name,x\nA,1"], "wrong.csv", { type: "text/csv" }));
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("Could not load"));
    expect(el("load-status").textContent).toContain("Missing required columns");
    expect(el("load-status").classList.contains("error")).toBe(true);
  });

  it("flips the theme from the header and remembers it", () => {
    el("theme-toggle").click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    el("theme-toggle").click();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("still flips the theme if storage refuses the write", () => {
    const restoreStorage = throwingStorage();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      el("theme-toggle").click();
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(warn).toHaveBeenCalledWith("Could not save theme preference:", expect.any(Error));
    } finally {
      restoreStorage();
      warn.mockRestore();
    }
  });

  it("renders and opens the changelog modal", async () => {
    const changelog = readFileSync(resolve(process.cwd(), "CHANGELOG.md"), "utf-8");
    const rendered = el("whats-new-content").querySelectorAll(".changelog-version");
    expect(rendered.length).toBe(Math.min(countChangelogVersions(changelog), WHATS_NEW_RECENT_VERSIONS));

    const modal = el<HTMLDialogElement>("whats-new-modal");
    el("whats-new-button").click();
    expect(modal.open).toBe(true);
    expect(window.location.hash).toBe("#changelog");
    el("whats-new-close").click();
    await vi.waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("opens the changelog from the fragment and closes it on a backdrop click", async () => {
    const modal = el<HTMLDialogElement>("whats-new-modal");
    window.location.hash = "changelog";
    await vi.waitFor(() => expect(modal.open).toBe(true));
    el("whats-new-content").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.open).toBe(true);
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.open).toBe(false);
  });
});
