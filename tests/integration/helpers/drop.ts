import type { Page } from "@playwright/test";

export interface FilePayload {
  name: string;
  mimeType?: string;
  buffer: Buffer;
}

/**
 * Loads a file through the dropzone's file chooser, the way the browse button does. A real
 * drag-and-drop cannot be scripted from outside the page, and the picker path ends in the same
 * `onFile` callback (see src/ui/dropzone.ts), so this is the one that gets driven.
 */
export async function dropFile(page: Page, file: FilePayload): Promise<void> {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("#dropzone").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: file.name,
    mimeType: file.mimeType ?? "application/octet-stream",
    buffer: file.buffer,
  });
}
