// @vitest-environment jsdom
// Boots the real app on a redirect back whose code the archive refuses: the page stays signed out,
// says why in the console, and keeps nothing.
import { routeFetch, textResponse } from "@brain-bbqs/test-utils/vitest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { OAUTH_PKCE_STORAGE_KEY } from "../../src/lib/oauth";
import { STORAGE_KEY } from "../../src/lib/settings";
import { OAUTH } from "./helpers/fakeArchive";
import { bootMain, el } from "./helpers/mainHarness";

const archive = routeFetch([{ match: `${OAUTH}/token/`, respond: () => textResponse("invalid_grant", 400) }]);
const error = vi.spyOn(console, "error").mockImplementation(() => {});

beforeAll(async () => {
  await bootMain({
    url: "?code=the-code&state=the-state",
    fetch: archive,
    sessionStorage: { [OAUTH_PKCE_STORAGE_KEY]: JSON.stringify({ verifier: "v", state: "the-state" }) },
  });
});

describe("main.ts boot, with a refused sign-in", () => {
  it("reports the refusal and stays signed out", async () => {
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "EMBER sign-in callback failed:",
        expect.objectContaining({ message: expect.stringMatching(/HTTP 400/) }),
      ),
    );
    expect(el("oauth-signin-btn").hidden).toBe(false);
    expect(el("oauth-signed-in").hidden).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
