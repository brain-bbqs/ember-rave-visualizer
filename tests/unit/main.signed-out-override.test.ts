// @vitest-environment jsdom
// Boots the real app under `?test&signed_out` with a real stored sign-in: every surface reads as
// signed out, the stored token is left alone, and nothing is asked of the archive with it.
import { beforeAll, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../../src/lib/settings";
import { bootMain, el } from "./helpers/mainHarness";

const stored = JSON.stringify({ oauth: { accessToken: "stored-token", expiresAt: Date.now() + 3_600_000 } });
let booted: Awaited<ReturnType<typeof bootMain>>;

beforeAll(async () => {
  booted = await bootMain({ url: "?test&fake_viewer&signed_out", localStorage: { [STORAGE_KEY]: stored } });
  await Promise.resolve();
});

describe("main.ts boot with ?test&signed_out over a stored sign-in", () => {
  it("shows the sign-in button and the browse hint", () => {
    expect(el("oauth-signin-btn").hidden).toBe(false);
    expect(el("oauth-signed-in").hidden).toBe(true);
    expect(el("browse-signin-hint").hidden).toBe(false);
  });

  it("leaves the stored token alone and never sends it", () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBe(stored);
    expect(booted.fetch?.calls).toEqual([]);
  });
});
