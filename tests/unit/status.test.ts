// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { renderLoadState } from "../../src/ui/status";

let status: HTMLDivElement;
let clearButton: HTMLButtonElement;

beforeEach(() => {
  status = document.createElement("div");
  clearButton = document.createElement("button");
  document.body.replaceChildren(status, clearButton);
});

describe("renderLoadState", () => {
  it("hides an idle status and clears stale content and classes", () => {
    status.className = "success";
    status.textContent = "old";
    clearButton.hidden = false;
    renderLoadState(status, clearButton, { kind: "idle" });
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe("");
    expect(status.className).toBe("");
    expect(clearButton.hidden).toBe(true);
  });

  it.each(["loading", "error"] as const)("renders a %s state without exposing the clear action", (kind) => {
    renderLoadState(status, clearButton, { kind, title: `${kind} title`, detail: `${kind} detail` });
    expect(status.hidden).toBe(false);
    expect(status.classList.contains(kind)).toBe(true);
    expect(status.querySelector("strong")?.textContent).toBe(`${kind} title`);
    expect(status.querySelector(".load-status-detail")?.textContent).toBe(`${kind} detail`);
    expect(clearButton.hidden).toBe(true);
  });

  it("shows the clear action only after a successful load", () => {
    renderLoadState(status, clearButton, { kind: "success", title: "Ready", detail: "2 electrodes" });
    expect(clearButton.hidden).toBe(false);
    expect(status.classList.contains("success")).toBe(true);
  });

  it("treats status text as text, not markup", () => {
    renderLoadState(status, clearButton, { kind: "loading", title: "<img>", detail: "<script>" });
    expect(status.querySelectorAll("img, script")).toHaveLength(0);
    expect(status.textContent).toContain("<img>");
  });

  it("omits the detail node when no detail was supplied", () => {
    renderLoadState(status, clearButton, { kind: "loading", title: "Working" });
    expect(status.querySelector(".load-status-detail")).toBeNull();
  });
});
