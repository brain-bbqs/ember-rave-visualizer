import { test, expect } from "@playwright/test";
import { seedTheme } from "@brain-bbqs/test-utils/playwright";
import { THEME_KEY } from "../../src/lib/settings";
import { dropFile } from "./helpers/drop";

test.describe("Web App Template shell", () => {
  test("renders branding, version, and the picker", async ({ page }) => {
    // Wide enough that the corner watermark and footer bar stay in their fixed, viewport-anchored
    // spots instead of the narrow-screen fallback (the max-width: 1400px query in @brain-bbqs/ui's
    // shell.css) that hides the watermark and flows the footer into the page to avoid overlapping cards.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page).toHaveTitle("Web App Template");
    await expect(page.locator("h1")).toHaveText("Web App Template");
    await expect(page.locator(".site-subtitle")).toContainText("single-page, backend-free");
    await expect(page.locator(".header-logo")).toBeVisible();
    await expect(page.locator(".brand-watermark-logo")).toBeVisible();
    const versionLink = page.locator("#version-indicator");
    await expect(versionLink).toHaveText(/^v\d+\.\d+\.\d+$/);
    await expect(versionLink).toHaveAttribute("href", "https://github.com/brain-bbqs/web-app-template");
    await expect(page.locator('a.footer-brand-link[href="https://centerforopenneuroscience.org"]')).toBeVisible();
    await expect(page.locator("#dropzone")).toBeVisible();
    await expect(page.locator("#file-card")).toBeHidden();
  });

  test("loads a picked file into the summary card, and Change file brings the picker back", async ({ page }) => {
    await page.goto("/");
    await dropFile(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.locator("#file-card")).toBeVisible();
    await expect(page.locator("#load-card")).toBeHidden();
    await expect(page.locator("#file-summary-name")).toHaveText("notes.txt");
    await expect(page.locator("#file-summary-stats")).toHaveText("5 B · text/plain");

    await page.locator("#change-file-btn").click();
    await expect(page.locator("#load-card")).toBeVisible();
    await expect(page.locator("#file-card")).toBeHidden();
  });

  test("lands straight on the loaded state from the ?test&mock_file injection", async ({ page }) => {
    await page.goto("/?test&mock_file");
    await expect(page.locator("#file-card")).toBeVisible();
    await expect(page.locator("#load-card")).toBeHidden();
    await expect(page.locator("#file-summary-name")).toHaveText("test-injection-mock-file.txt");
  });

  test("boots for real when ?test names nothing to fake", async ({ page }) => {
    await page.goto("/?test");
    await expect(page.locator("#dropzone")).toBeVisible();
    await expect(page.locator("#file-card")).toBeHidden();
  });

  test("flips the theme from the header toggle and keeps it across a reload", async ({ page }) => {
    // Start from the light theme so the single toggle click below lands on dark.
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await page.locator("html").getAttribute("data-theme")).toBe(null);
    await page.locator("#theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("applies a stored theme before first paint", async ({ page }) => {
    await seedTheme(page, "dark", { storageKey: THEME_KEY });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("opens What's New from the footer and from the #changelog fragment", async ({ page }) => {
    await page.goto("/");
    const modal = page.locator("#whats-new-modal");
    await page.locator("#whats-new-button").click();
    await expect(modal).toBeVisible();
    await expect(modal.locator(".changelog-version").first()).toBeVisible();
    await expect(page).toHaveURL(/#changelog$/);

    await page.locator("#whats-new-close").click();
    await expect(modal).toBeHidden();
    await expect(page).not.toHaveURL(/#changelog/);

    await page.goto("/#changelog");
    await expect(modal).toBeVisible();
  });

  test("drops the fixed watermark once the viewport is too narrow to frame the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.locator(".brand-watermark-link")).toBeHidden();
    // The footer stays, but in normal document flow under the page content.
    await expect(page.locator(".page-footer-bar")).toHaveCSS("position", "static");
    await expect(page.locator(".footer-brand-link")).toBeVisible();
  });
});
