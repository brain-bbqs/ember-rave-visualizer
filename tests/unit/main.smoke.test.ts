// @vitest-environment jsdom
// Boots the real src/main.ts against the real index.html markup and drives the shell end to end
// (version stamp, file pick and reset, theme toggle, What's New modal). Besides covering main.ts's
// wiring, this guards the index.html/elements.ts id contract: getShell() and getElements() throw
// on import if any registered id is missing from the page.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { throwingStorage } from "@brain-bbqs/test-utils/vitest";
import { countChangelogVersions } from "@brain-bbqs/ui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { THEME_KEY } from "../../src/lib/settings";
import { bootMain, el, pickFile } from "./helpers/mainHarness";

const WHATS_NEW_RECENT_VERSIONS = 3;

beforeAll(async () => {
  await bootMain();
});

describe("main.ts boot", () => {
  it("stamps the version into the footer link", () => {
    expect(el("version-indicator").textContent).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it("opens on the picker, with the loaded-file card hidden", () => {
    expect(el("load-card").hidden).toBe(false);
    expect(el("file-card").hidden).toBe(true);
  });

  it("swaps to the loaded-file card once a file is picked, and back on Change file", () => {
    pickFile(new File(["hello"], "notes.txt", { type: "text/plain" }));
    expect(el("file-card").hidden).toBe(false);
    expect(el("load-card").hidden).toBe(true);
    expect(el("file-summary-name").textContent).toBe("notes.txt");
    expect(el("file-summary-stats").textContent).toBe("5 B · text/plain");

    el("change-file-btn").click();
    expect(el("file-card").hidden).toBe(true);
    expect(el("load-card").hidden).toBe(false);
    expect(el("file-summary-name").textContent).toBe("");
    expect(el("file-summary-stats").textContent).toBe("");
  });

  it("describes a file with no MIME type by its size alone", () => {
    pickFile(new File([new Uint8Array(2048)], "blob.bin"));
    expect(el("file-summary-stats").textContent).toBe("2.0 KB");
    el("change-file-btn").click();
  });

  it("flips the theme from the header toggle and remembers the choice", () => {
    // The matchMedia stub reports a light OS preference and nothing is stored, so the first
    // click lands on dark.
    el("theme-toggle").click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    el("theme-toggle").click();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("still flips the theme when storage refuses the write, and warns rather than throws", () => {
    const restoreStorage = throwingStorage();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      el("theme-toggle").click();
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("Could not save theme preference:", expect.any(Error));
    } finally {
      restoreStorage();
      warn.mockRestore();
    }
  });

  it("renders the changelog into the What's New modal", () => {
    const changelog = readFileSync(resolve(process.cwd(), "CHANGELOG.md"), "utf-8");
    const rendered = el("whats-new-content").querySelectorAll(".changelog-version");
    expect(rendered.length).toBe(Math.min(countChangelogVersions(changelog), WHATS_NEW_RECENT_VERSIONS));
    expect(el("whats-new-show-more").hidden).toBe(countChangelogVersions(changelog) <= WHATS_NEW_RECENT_VERSIONS);
  });

  it("opens and closes the modal from the footer, tracking the #changelog fragment", async () => {
    const modal = el<HTMLDialogElement>("whats-new-modal");
    el("whats-new-button").click();
    expect(modal.open).toBe(true);
    expect(window.location.hash).toBe("#changelog");

    el("whats-new-close").click();
    expect(modal.open).toBe(false);
    // The dialog's close event, and so the fragment cleanup, may be dispatched asynchronously.
    await vi.waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("opens the modal when the page is pointed at the #changelog fragment", async () => {
    const modal = el<HTMLDialogElement>("whats-new-modal");
    window.location.hash = "changelog";
    await vi.waitFor(() => expect(modal.open).toBe(true));
    el("whats-new-close").click();
    await vi.waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("leaves the modal closed when the fragment changes to anything else", () => {
    const modal = el<HTMLDialogElement>("whats-new-modal");
    expect(modal.open).toBe(false);
    window.history.replaceState(null, "", "#elsewhere");
    // Dispatched here rather than awaited: jsdom queues its own hashchange, and whether that lands
    // before the test ends would decide whether this path runs at all.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(modal.open).toBe(false);
    expect(window.location.hash).toBe("#elsewhere");
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("closes the modal on a backdrop click", () => {
    const modal = el<HTMLDialogElement>("whats-new-modal");
    el("whats-new-button").click();
    expect(modal.open).toBe(true);
    // A click whose target is the <dialog> itself is a click on its backdrop; one on the
    // content inside it is not.
    el("whats-new-content").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.open).toBe(true);
    modal.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.open).toBe(false);
  });

  it("swaps in the entire changelog behind Show more", () => {
    const changelog = readFileSync(resolve(process.cwd(), "CHANGELOG.md"), "utf-8");
    el("whats-new-show-more").click();
    expect(el("whats-new-show-more").hidden).toBe(true);
    expect(el("whats-new-content").querySelectorAll(".changelog-version").length).toBe(
      countChangelogVersions(changelog),
    );
  });
});
