import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { settingsStore, STORAGE_KEY, THEME_KEY } from "../../src/lib/settings";

const { name } = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as { name: string };

// Storing, loading and refusing the theme are @brain-bbqs/ui's (initThemeToggle), and the settings
// store is @brain-bbqs/ember-client's; the app's part is the keys, which the pre-paint script reads
// too. Renaming either would drop a returning visitor's theme or sign-in.
describe("storage keys", () => {
  it("are namespaced by this app's package name", () => {
    expect(THEME_KEY).toBe(`${name}.theme`);
    expect(STORAGE_KEY).toBe(`${name}.settings.v1`);
  });

  it("back the settings store", () => {
    expect(settingsStore.key).toBe(STORAGE_KEY);
  });
});
