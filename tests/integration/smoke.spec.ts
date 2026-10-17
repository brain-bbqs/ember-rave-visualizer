import { expect, test } from "@playwright/test";
import { seedTheme } from "@brain-bbqs/test-utils/playwright";
import { THEME_KEY } from "../../src/lib/settings";
import { dropFile } from "./helpers/drop";

const VALID_CSV = "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,-8.2,4.2,30.1,A1";

test.describe("EMBER RAVE Visualizer", () => {
  test("renders the BBQS shell, source picker, viewer, and credits", async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1100 });
    await page.goto("/?test&fake_viewer");
    await expect(page).toHaveTitle("EMBER RAVE Visualizer");
    await expect(page.locator("h1")).toHaveText("EMBER RAVE Visualizer");
    await expect(page.locator(".site-subtitle")).toContainText("MNI152 template brain");
    await expect(page.locator(".header-logo")).toBeVisible();
    await expect(page.locator(".brand-watermark-logo")).toBeVisible();
    await expect(page.locator("#version-indicator")).toHaveAttribute(
      "href",
      "https://github.com/brain-bbqs/ember-rave-visualizer",
    );
    await expect(page.locator("#dropzone")).toBeVisible();
    await expect(page.locator("#viewer-card")).toBeVisible();
    await expect(page.locator("#viewer-test-placeholder")).toBeVisible();
    await expect(page.locator(".viewer-credit")).toContainText("three-brain-js");
  });

  test("loads and removes a dropped local electrode CSV", async ({ page }) => {
    await page.goto("/?test&fake_viewer");
    await dropFile(page, { name: "subject.csv", mimeType: "text/csv", buffer: Buffer.from(VALID_CSV) });
    const status = page.locator("#load-status");
    await expect(status).toContainText("subject.csv loaded");
    await expect(status).toContainText("1 electrode · 5 columns · Local file");
    await expect(page.locator("#clear-electrodes-btn")).toBeVisible();

    await page.locator("#clear-electrodes-btn").click();
    await expect(status).toBeHidden();
  });

  test("rejects a non-CSV drop before trying to load it", async ({ page }) => {
    await page.goto("/?test&fake_viewer");
    await dropFile(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.locator("#dropzone-reject")).toContainText("not a CSV");
    await expect(page.locator("#load-status")).toBeHidden();
  });

  test("converts a GitHub blob URL to raw content and loads it", async ({ page }) => {
    const rawUrl = "https://raw.githubusercontent.com/rave-ieeg/rave-ieeg.github.io/abc123/posts/3dviewer/PAV080.csv";
    await page.route(rawUrl, async (route) => {
      await route.fulfill({ status: 200, contentType: "text/csv", body: VALID_CSV });
    });
    await page.goto("/?test&fake_viewer&source_url");
    await expect(page.locator("#url-source-pane")).toBeVisible();
    await page
      .locator("#url-input")
      .fill("https://github.com/rave-ieeg/rave-ieeg.github.io/blob/abc123/posts/3dviewer/PAV080.csv");
    await page.locator("#load-url-btn").click();
    await expect(page.locator("#load-status")).toContainText("PAV080.csv loaded");
    await expect(page.locator("#load-status")).toContainText("raw.githubusercontent.com");
  });

  test("lands on a deterministic loaded state from ?test&mock_csv", async ({ page }) => {
    await page.goto("/?test&mock_csv");
    await expect(page.locator("#load-status")).toContainText("test-injection-mock-electrodes.csv loaded");
    await expect(page.locator("#viewer-test-placeholder")).toBeVisible();
  });

  test("flips the theme and keeps it across reloads", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/?test&fake_viewer");
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("applies a stored theme before first paint", async ({ page }) => {
    await seedTheme(page, "dark", { storageKey: THEME_KEY });
    await page.goto("/?test&fake_viewer");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("opens What's New from the footer and the changelog fragment", async ({ page }) => {
    await page.goto("/?test&fake_viewer");
    const modal = page.locator("#whats-new-modal");
    await page.locator("#whats-new-button").click();
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/#changelog$/);
    await page.locator("#whats-new-close").click();
    await expect(modal).toBeHidden();

    await page.goto("/?test&fake_viewer#changelog");
    await expect(modal).toBeVisible();
  });

  test("flows the footer below the wide viewer at a standard desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?test&fake_viewer");
    await expect(page.locator(".brand-watermark-link")).toBeHidden();
    await expect(page.locator(".page-footer-bar")).toHaveCSS("position", "static");
    await expect(page.locator(".footer-brand-link")).toBeVisible();
  });
});
