import { expect, test } from "@chromatic-com/playwright";
import { expectNoHorizontalOverflow, forEachViewport } from "@brain-bbqs/test-utils/playwright";

forEachViewport(test, "Main page - local CSV picker", async ({ page }) => {
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

forEachViewport(test, "Main page - electrode CSV loaded", async ({ page }) => {
  await page.goto("/?test&mock_csv");
  await expect(page.locator("#load-status")).toContainText("test-injection-mock-electrodes.csv loaded");
  await expect(page.locator("#viewer-test-placeholder")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
