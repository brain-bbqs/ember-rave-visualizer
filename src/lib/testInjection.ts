// Live smoketest URL params (`?test&...`), the scheme every BBQS companion app shares (see
// docs/README.md): a link pasted into the deployed app's address bar drives the UI into a specific,
// real state with no local file, no sign-in and no network call, purely so a human can eyeball every
// important UI state live and so Playwright specs (the Chromatic snapshots above all) can reach the
// same states without heavy `page.route` stubbing.
//
// This module only *parses* the query string into a plan; every field here is inert until main.ts
// reads it and, at the exact point the real code path would otherwise have read a real file or made
// a network call, substitutes the fake below instead. That split keeps the fakes honest: a state
// built this way runs through the same rendering code a real one would, so a screenshot of it is a
// screenshot of the real UI, not a mockup drawn beside it.
//
// `?test` alone (with none of the params below) is a no-op: every field defaults to off, so nothing
// downstream branches away from the ordinary boot path. Nothing here writes to localStorage.

/** What one `?test&...` URL asks the app to fake. */
export interface TestInjection {
  /** Loads a synthesized file as if it had been dropped in, so the loaded-file state can be looked
   * at (and snapshotted) without picking a real file. */
  mockFile: boolean;
}

/**
 * Reads `?test&...` out of a query string, or null when the page was not asked to fake anything,
 * the ordinary case, which every caller should treat as "boot for real".
 */
export function readTestInjection(search: string): TestInjection | null {
  const params = new URLSearchParams(search);
  if (!params.has("test")) return null;
  return {
    mockFile: params.has("mock_file"),
  };
}

/** Named so a screenshot of the mock is recognizable as one rather than mistaken for a real file. */
export const MOCK_FILE_NAME = "test-injection-mock-file.txt";
const MOCK_FILE_BYTES = 12_345;

/** The file `?test&mock_file` loads: fixed name and size, so every snapshot of it comes out alike. */
export function synthesizeMockFile(): File {
  return new File([new Uint8Array(MOCK_FILE_BYTES)], MOCK_FILE_NAME, { type: "text/plain" });
}
