import { test, expect } from "@chromatic-com/playwright";
import { expectNoHorizontalOverflow, forEachViewport } from "@brain-bbqs/test-utils/playwright";

// forEachViewport registers each state once per viewport, sized and named in the title, since
// Chromatic keys a capture by the test's title alone.

forEachViewport(test, "Main page - default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#dropzone")).toBeVisible();
  await expect(page.locator("#file-card")).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

forEachViewport(test, "Main page - file loaded", async ({ page }) => {
  // The mock file has a fixed name and size (see src/lib/testInjection.ts), so the capture is
  // the same on every run.
  await page.goto("/?test&mock_file");
  await expect(page.locator("#file-card")).toBeVisible();
  await expect(page.locator("#load-card")).toBeHidden();
  await expectNoHorizontalOverflow(page);
});
