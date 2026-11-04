import { expect, test } from "@playwright/test";
import { stubIdentity } from "@brain-bbqs/test-utils/playwright";
import { STORAGE_KEY } from "../../src/lib/settings";

test.describe("EMBER sign-in and browsing", () => {
  test("the sign-in button starts the EMBER OAuth redirect", async ({ page }) => {
    await page.goto("/?test&fake_viewer");
    // The archive itself is out of scope here: intercept the redirect and assert only that the app
    // leaves for the right authorize URL.
    await page.route("https://api-dandi.emberarchive.org/**", (route) => route.fulfill({ body: "" }));
    await page.locator("#oauth-signin-btn").click();
    await page.waitForURL(/api-dandi\.emberarchive\.org\/oauth\/authorize\//);
    const url = new URL(page.url());
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/$/);
  });

  test("a returning visitor lands signed in, with their account in the header", async ({ page }) => {
    const tokens = { accessToken: "stored-token", expiresAt: Date.now() + 3_600_000 };
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
      STORAGE_KEY,
      JSON.stringify({ oauth: tokens }),
    ] as const);
    await stubIdentity(page, { username: "ada", name: "Ada Lovelace" });
    await page.goto("/?test&fake_viewer");
    await expect(page.locator("#oauth-signin-btn")).toBeHidden();
    await expect(page.locator("#oauth-avatar")).toHaveText("AL");
    await page.locator("#oauth-avatar").hover();
    await expect(page.locator("#oauth-username")).toHaveText("ada");
  });

  test("Browse EMBER lists datasets and their tables, and answers a pick", async ({ page }) => {
    await page.goto("/?test&fake_viewer&signed_in&remote_listing=4");
    const datasets = page.locator("#browse-dandisets .browse-item");
    await expect(datasets).toHaveCount(2);
    await expect(datasets.nth(1).locator(".badge")).toHaveText("embargoed");

    await datasets.first().click();
    await expect(page.locator("#browse-table-heading")).toHaveText("Tables in 214000");
    await expect(page.locator("#browse-dandiset-link")).toHaveAttribute(
      "href",
      "https://dandi.emberarchive.org/dandiset/214000/draft",
    );
    const tables = page.locator("#browse-tables .browse-item");
    await expect(tables).toHaveCount(3);
    await tables.first().click();
    await expect(page.locator("#load-status")).toContainText("Could not download the electrode table");
  });
});
