// @vitest-environment jsdom
// Boots the real app under `?test&fake_viewer&signed_in&remote_listing=4`: a fake account in the
// header and a fake listing in Browse EMBER, with nothing read from the archive or written to storage.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bootMain, el } from "./helpers/mainHarness";

let booted: Awaited<ReturnType<typeof bootMain>>;

beforeAll(async () => {
  booted = await bootMain("?test&fake_viewer&signed_in&remote_listing=4");
});

function rowButton(listId: string, text: string): HTMLButtonElement {
  const button = [...el(listId).querySelectorAll<HTMLButtonElement>(".browse-item")].find((b) =>
    b.textContent?.includes(text),
  );
  if (!button) throw new Error(`No row containing ${text}`);
  return button;
}

describe("main.ts boot with ?test&fake_viewer&signed_in&remote_listing=4", () => {
  it("shows the fake account in the header", async () => {
    await vi.waitFor(() => expect(el("oauth-username").textContent).toBe("test-user"));
    expect(el("oauth-avatar").textContent).toBe("LS");
    expect(el("oauth-signin-btn").hidden).toBe(true);
  });

  it("opens Browse EMBER on the fake listing", async () => {
    expect(el("ember-source-pane").hidden).toBe(false);
    expect(el("source-ember-btn").getAttribute("aria-pressed")).toBe("true");
    await vi.waitFor(() =>
      expect([...el("browse-dandisets").querySelectorAll("li")].map((li) => li.textContent)).toEqual([
        "214000Test dataset 13 tables",
        "214001embargoedTest dataset 21 table",
      ]),
    );
  });

  it("answers a fake public table with the ordinary download refusal", async () => {
    rowButton("browse-dandisets", "Test dataset 1").click();
    rowButton("browse-tables", "sub-01_electrodes.tsv").click();
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("Could not download the electrode table"));
    expect(el("load-status").textContent).toContain("remote server may not allow browser access");
  });

  it("asks for a real sign-in before reading an embargoed table", async () => {
    rowButton("browse-dandisets", "Test dataset 2").click();
    rowButton("browse-tables", "sub-04_electrodes.tsv").click();
    await vi.waitFor(() =>
      expect(el("load-status").textContent).toContain("Sign in with EMBER to load this embargoed table."),
    );
  });

  it("reads nothing from the archive and stores nothing", () => {
    expect(booted.fetch?.calls.map((c) => c.url)).toEqual([
      "https://test-injection.invalid/214000/sub-01_electrodes.tsv",
    ]);
    expect(localStorage.length).toBe(0);
  });
});
