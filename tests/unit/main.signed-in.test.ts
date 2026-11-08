// @vitest-environment jsdom
// Boots the real app as a returning visitor whose stored EMBER token is about to expire, against a
// stubbed archive: the token is refreshed, the header names the account, Browse EMBER lists a public
// dataset and the visitor's own embargoed one, both load, and signing out revokes the token.
import { jsonResponse, routeFetch } from "@brain-bbqs/test-utils/vitest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../../src/lib/settings";
import { API, archiveRoutes, bucketUrl, OAUTH } from "./helpers/fakeArchive";
import { bootMain, el } from "./helpers/mainHarness";

const CSV = "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,1,2,3,A1\n2,4,5,6,A2";

const archive = routeFetch([
  {
    match: `${OAUTH}/token/`,
    respond: () => jsonResponse({ access_token: "fresh-token", refresh_token: "rt2", expires_in: 3600 }),
  },
  { match: `${OAUTH}/revoke_token/`, respond: () => jsonResponse({}) },
  { match: `${API}/users/me/`, respond: () => jsonResponse({ username: "ada", name: "Ada Lovelace" }) },
  {
    match: `${API}/dandisets/?user=me&embargoed=true&page_size=1000`,
    respond: () =>
      jsonResponse({
        results: [{ identifier: "000009", embargo_status: "EMBARGOED", draft_version: { name: "Ada's Lab" } }],
      }),
  },
  { match: `${API}/dandisets/000009/users/`, respond: () => jsonResponse([{ username: "ada" }]) },
  {
    match: `${API}/dandisets/000009/versions/draft/assets/`,
    respond: () => jsonResponse({ results: [{ asset_id: "a1", path: "sub-02/sub-02_electrodes.tsv", size: 40 }] }),
  },
  { match: `${API}/assets/a1/download/`, respond: () => new Response(CSV.replace(/,/g, "\t")) },
  { match: bucketUrl("000001", "sub-01_electrodes.csv"), respond: () => new Response(CSV) },
  ...archiveRoutes([{ id: "000001", name: "Public Lab", tables: [["sub-01_electrodes.csv", 70]] }]),
]);

const stored = JSON.stringify({
  oauth: { accessToken: "stale-token", refreshToken: "rt", expiresAt: Date.now() + 30_000 },
});

beforeAll(async () => {
  await bootMain({ url: "?test&fake_viewer", fetch: archive, localStorage: { [STORAGE_KEY]: stored } });
});

function storedOAuth(): { accessToken?: string } | undefined {
  return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { oauth?: { accessToken?: string } } | null)
    ?.oauth;
}

function rowButton(listId: string, text: string): HTMLButtonElement {
  const button = [...el(listId).querySelectorAll<HTMLButtonElement>(".browse-item")].find((b) =>
    b.textContent?.includes(text),
  );
  if (!button) throw new Error(`No row containing ${text}`);
  return button;
}

describe("main.ts boot, signed in", () => {
  it("swaps the sign-in button for the account menu, naming the account", async () => {
    expect(el("oauth-signin-btn").hidden).toBe(true);
    expect(el("oauth-signed-in").hidden).toBe(false);
    expect(el("browse-signin-hint").hidden).toBe(true);
    await vi.waitFor(() => expect(el("oauth-username").textContent).toBe("ada"));
    expect(el("oauth-avatar").textContent).toBe("AL");
  });

  it("refreshes the nearly expired token once, and keeps the fresh one", async () => {
    await vi.waitFor(() => expect(storedOAuth()?.accessToken).toBe("fresh-token"));
    expect(archive.callsTo("/oauth/token/").length).toBe(1);
    const [me] = archive.callsTo("/users/me/");
    expect(new Headers(me.init?.headers).get("Authorization")).toBe("Bearer fresh-token");
  });

  it("lists the public dataset and the visitor's own embargoed one under Browse EMBER", async () => {
    el("source-ember-btn").click();
    expect(el("ember-source-pane").hidden).toBe(false);
    await vi.waitFor(() =>
      expect([...el("browse-dandisets").querySelectorAll("li")].map((li) => li.textContent)).toEqual([
        "000001Public Lab1 table",
        "000009embargoedAda's Lab1 table",
      ]),
    );
  });

  it("loads a public table from the bucket", async () => {
    rowButton("browse-dandisets", "Public Lab").click();
    rowButton("browse-tables", "sub-01_electrodes.csv").click();
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("sub-01_electrodes.csv loaded"));
    expect(el("load-status").textContent).toContain("2 electrodes · 5 columns · EMBER · 000001");
    const [download] = archive.callsTo("/blobs/000001/");
    expect(new Headers(download.init?.headers).get("Authorization")).toBeNull();
  });

  it("loads an embargoed table through the archive, with the token", async () => {
    rowButton("browse-dandisets", "Ada's Lab").click();
    rowButton("browse-tables", "sub-02_electrodes.tsv").click();
    expect(el("load-status").textContent).toContain("Downloading sub-02_electrodes.tsv from EMBER");
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("sub-02_electrodes.tsv loaded"));
    expect(el("load-status").textContent).toContain("EMBER · 000009");
    const [download] = archive.callsTo("/assets/a1/download/");
    expect(new Headers(download.init?.headers).get("Authorization")).toBe("Bearer fresh-token");
  });

  it("signs out: revokes the token, forgets it, and drops the embargoed dataset from the list", async () => {
    el("oauth-signout-btn").click();
    expect(el("oauth-signin-btn").hidden).toBe(false);
    expect(el("oauth-signed-in").hidden).toBe(true);
    expect(el("browse-signin-hint").hidden).toBe(false);
    expect(storedOAuth()).toBeUndefined();
    const [revoke] = archive.callsTo("/oauth/revoke_token/");
    expect(new URLSearchParams(String(revoke.init?.body)).get("token")).toBe("fresh-token");
    await vi.waitFor(() =>
      expect([...el("browse-dandisets").querySelectorAll("li")].map((li) => li.textContent)).toEqual([
        "000001Public Lab1 table",
      ]),
    );
  });
});
