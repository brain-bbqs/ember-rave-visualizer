import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { dropFile } from "./helpers/drop";

const EXAMPLE_TABLE = resolve(process.cwd(), "public/examples/example-electrodes.tsv");

test("loads the real RAVE viewer from its data folder and plots the README example as TSV and CSV", async ({
  page,
}) => {
  // The real WebGL engine renders in software here and fetches ~13 MB of template data.
  test.setTimeout(180_000);
  const failedViewerRequests: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/vendor/rave/") && !response.ok()) {
      failedViewerRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.locator("#viewer-loading")).toBeHidden({ timeout: 150_000 });

  await dropFile(page, {
    name: "example-electrodes.tsv",
    mimeType: "text/tab-separated-values",
    buffer: readFileSync(EXAMPLE_TABLE),
  });
  await expect(page.locator("#load-status")).toContainText("example-electrodes.tsv loaded");
  await expect(page.locator("#load-status")).toContainText("9 electrodes · 5 columns");

  const asCsv = readFileSync(EXAMPLE_TABLE, "utf8").replaceAll("\t", ",");
  await dropFile(page, { name: "example-electrodes.csv", mimeType: "text/csv", buffer: Buffer.from(asCsv) });
  await expect(page.locator("#load-status")).toContainText("example-electrodes.csv loaded");
  await expect(page.locator("#load-status")).toContainText("9 electrodes · 5 columns");
  expect(failedViewerRequests).toEqual([]);
});
