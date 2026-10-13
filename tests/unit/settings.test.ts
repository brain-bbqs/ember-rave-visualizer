import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_KEY } from "../../src/lib/settings";

// Storing, loading and refusing the theme are @brain-bbqs/ui's (initThemeToggle) and are tested
// there; the app's part is the key, which the toggle and the pre-paint script have to share.
describe("THEME_KEY", () => {
  it("is namespaced by this app's package name", () => {
    const { name } = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf-8")) as { name: string };
    expect(THEME_KEY).toBe(`${name}.theme`);
  });
});
