// @vitest-environment jsdom
// Boots the real app on the archive's redirect back from its authorize page: the code is exchanged,
// the tokens are kept, the OAuth parameters leave the address bar, and the header names the account.
import { jsonResponse, routeFetch } from "@brain-bbqs/test-utils/vitest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { OAUTH_CLIENT_ID, OAUTH_PKCE_STORAGE_KEY } from "../../src/lib/oauth";
import { STORAGE_KEY } from "../../src/lib/settings";
import { API, OAUTH } from "./helpers/fakeArchive";
import { bootMain, el } from "./helpers/mainHarness";

const archive = routeFetch([
  {
    match: `${OAUTH}/token/`,
    respond: () => jsonResponse({ access_token: "new-token", refresh_token: "rt", expires_in: 3600 }),
  },
  { match: `${API}/users/me/`, respond: () => jsonResponse({ username: "ada", name: "Ada Lovelace" }) },
]);

beforeAll(async () => {
  await bootMain({
    url: "?code=the-code&state=the-state",
    fetch: archive,
    sessionStorage: { [OAUTH_PKCE_STORAGE_KEY]: JSON.stringify({ verifier: "v", state: "the-state" }) },
  });
});

describe("main.ts boot, landing from the archive's sign-in", () => {
  it("exchanges the code under this app's client id and keeps the tokens", async () => {
    await vi.waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")?.oauth?.accessToken).toBe("new-token"),
    );
    const [exchange] = archive.callsTo("/oauth/token/");
    const body = new URLSearchParams(String(exchange.init?.body));
    expect(body.get("client_id")).toBe(OAUTH_CLIENT_ID);
    expect(body.get("code")).toBe("the-code");
    expect(window.location.search).toBe("");
  });

  it("shows the account menu", async () => {
    await vi.waitFor(() => expect(el("oauth-signed-in").hidden).toBe(false));
    expect(el("oauth-signin-btn").hidden).toBe(true);
    await vi.waitFor(() => expect(el("oauth-username").textContent).toBe("ada"));
  });
});
