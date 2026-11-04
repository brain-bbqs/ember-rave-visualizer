// @vitest-environment jsdom
// The shared client's behaviour is tested in @brain-bbqs/ember-client; what is pinned here is the
// identity the archive knows this app by, and that the app's client runs the flow under it.
import { webcrypto } from "node:crypto";
import { jsonResponse, routeFetch } from "@brain-bbqs/test-utils/vitest";
import { EMBER_INSTANCE } from "@brain-bbqs/ember-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAUTH_CLIENT_ID, OAUTH_PKCE_STORAGE_KEY, oauth } from "../../src/lib/oauth";

beforeEach(() => {
  // jsdom's Crypto has getRandomValues but no SubtleCrypto, which the PKCE challenge needs.
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the sign-in identity the archive knows this app by", () => {
  // Any drift would strand a login that is mid-redirect across a deploy, or fail every new one.
  it("keeps the registered client id and the pending-login key", () => {
    expect(OAUTH_CLIENT_ID).toBe("WjVWvWBVkGgsBI7G8hSKqabn0jkWntvgUpGfOppi");
    expect(OAUTH_PKCE_STORAGE_KEY).toBe("ember-rave-visualizer.oauth-pkce.v1");
  });

  it("redirects to the archive's authorize page under this app's client id, asking for no scope", async () => {
    let navigated = "";
    await oauth.startLogin((url) => (navigated = url));
    const url = new URL(navigated);
    expect(url.origin + url.pathname).toBe(`${EMBER_INSTANCE.oauth}/authorize/`);
    expect(url.searchParams.get("client_id")).toBe(OAUTH_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(`${window.location.origin}/`);
    expect([...url.searchParams.keys()].sort()).toEqual(
      ["client_id", "code_challenge", "code_challenge_method", "redirect_uri", "response_type", "state"].sort(),
    );
    const pending = JSON.parse(sessionStorage.getItem(OAUTH_PKCE_STORAGE_KEY) ?? "null") as { state: string } | null;
    expect(pending?.state).toBe(url.searchParams.get("state"));
  });

  it("completes the callback against the same client id and stash", async () => {
    const fetchMock = routeFetch([
      {
        match: "/oauth/token/",
        respond: () => jsonResponse({ access_token: "at", refresh_token: "rt", expires_in: 60 }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.setItem(OAUTH_PKCE_STORAGE_KEY, JSON.stringify({ verifier: "v", state: "s" }));
    window.history.replaceState({}, "", "/ember-rave-visualizer/?code=c&state=s");

    expect(await oauth.handleRedirectCallback()).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: expect.any(Number),
    });
    expect(Object.fromEntries(new URLSearchParams(String(fetchMock.calls[0].init?.body)))).toEqual({
      grant_type: "authorization_code",
      code: "c",
      redirect_uri: `${window.location.origin}/ember-rave-visualizer/`,
      client_id: OAUTH_CLIENT_ID,
      code_verifier: "v",
    });
    expect(window.location.search).toBe("");
  });
});
