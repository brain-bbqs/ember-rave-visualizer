// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bootMain, el } from "./helpers/mainHarness";

const fetcher = vi.fn(async () => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  text: async () => "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,1,2,3,A1",
}));

beforeAll(async () => {
  vi.stubGlobal("fetch", fetcher);
  await bootMain("?test&fake_viewer&source_url");
});

describe("main.ts remote URL flow", () => {
  it("opens directly on the URL source pane", () => {
    expect(el("local-source-pane").hidden).toBe(true);
    expect(el("url-source-pane").hidden).toBe(false);
  });

  it("shows URL validation failures without making a request", async () => {
    el<HTMLInputElement>("url-input").value = "not a complete URL";
    el<HTMLFormElement>("url-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("complete HTTP or HTTPS URL"));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("normalizes and loads a GitHub blob URL", async () => {
    el<HTMLInputElement>("url-input").value =
      "https://github.com/rave-ieeg/rave-ieeg.github.io/blob/abc123/posts/3dviewer/PAV080.csv";
    el<HTMLFormElement>("url-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(el("load-status").textContent).toContain("PAV080.csv loaded"));
    expect(fetcher).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/rave-ieeg/rave-ieeg.github.io/abc123/posts/3dviewer/PAV080.csv",
      { signal: expect.any(AbortSignal) },
    );
    expect(el("load-status").textContent).toContain("Remote URL · raw.githubusercontent.com");
  });
});
