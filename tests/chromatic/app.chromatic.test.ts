import { expect, test } from "@chromatic-com/playwright";
import { expectNoHorizontalOverflow, forEachViewport } from "@brain-bbqs/test-utils/playwright";

forEachViewport(test, "Main page - local table picker", async ({ page }) => {
  await page.goto("/?test&fake_viewer");
  await expect(page.locator("#dropzone")).toBeVisible();
  await expect(page.locator("#viewer-test-placeholder")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

forEachViewport(test, "Main page - remote URL picker", async ({ page }) => {
  await page.goto("/?test&fake_viewer&source_url");
  await expect(page.locator("#url-source-pane")).toBeVisible();
  await expect(page.locator("#viewer-test-placeholder")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

forEachViewport(test, "Main page - electrode table loaded", async ({ page }) => {
  await page.goto("/?test&mock_table");
  await expect(page.locator("#load-status")).toContainText("test-injection-mock-electrodes.tsv loaded");
  await expect(page.locator("#viewer-test-placeholder")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

forEachViewport(test, "Main page - Browse EMBER", async ({ page }) => {
  await page.goto("/?test&fake_viewer&remote_listing=7");
  await page.locator("#browse-dandisets .browse-item").first().click();
  await expect(page.locator("#browse-tables .browse-item")).toHaveCount(3);
  await expectNoHorizontalOverflow(page);
});

forEachViewport(test, "Main page - signed in, Browse EMBER", async ({ page }) => {
  await page.goto("/?test&fake_viewer&signed_in&remote_listing=7");
  await expect(page.locator("#oauth-avatar")).toHaveText("LS");
  await expect(page.locator("#browse-dandisets .badge")).toHaveText("embargoed");
  await expectNoHorizontalOverflow(page);
});
