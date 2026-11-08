// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initSourcePicker, type SourcePickerElements } from "../../src/ui/sourcePicker";

function setup() {
  const button = () => document.createElement("button");
  const pane = (hidden: boolean) => Object.assign(document.createElement("div"), { hidden });
  const form = document.createElement("form");
  const input = document.createElement("input");
  form.appendChild(input);
  const els: SourcePickerElements = {
    sourceLocalBtn: button(),
    sourceEmberBtn: button(),
    sourceUrlBtn: button(),
    localSourcePane: pane(false),
    emberSourcePane: pane(true),
    urlSourcePane: pane(true),
    urlForm: form,
    urlInput: input,
  };
  document.body.append(...Object.values(els));
  const onRemoteUrl = vi.fn();
  const onSelect = vi.fn();
  const picker = initSourcePicker(els, { onRemoteUrl, onSelect });
  return { els, onRemoteUrl, onSelect, picker };
}

function shown(els: SourcePickerElements): boolean[] {
  return [els.localSourcePane, els.emberSourcePane, els.urlSourcePane].map((pane) => !pane.hidden);
}

function pressed(els: SourcePickerElements): (string | null)[] {
  return [els.sourceLocalBtn, els.sourceEmberBtn, els.sourceUrlBtn].map((b) => b.getAttribute("aria-pressed"));
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("initSourcePicker", () => {
  it("switches to and focuses the remote URL pane", () => {
    const { els, onSelect } = setup();
    els.sourceUrlBtn.click();
    expect(shown(els)).toEqual([false, false, true]);
    expect(pressed(els)).toEqual(["false", "false", "true"]);
    expect(els.sourceUrlBtn.classList.contains("active")).toBe(true);
    expect(document.activeElement).toBe(els.urlInput);
    expect(onSelect).toHaveBeenCalledWith("url");
  });

  it("switches to the EMBER pane and reports it, without stealing focus", () => {
    const { els, onSelect } = setup();
    els.sourceEmberBtn.click();
    expect(shown(els)).toEqual([false, true, false]);
    expect(pressed(els)).toEqual(["false", "true", "false"]);
    expect(document.activeElement).toBe(document.body);
    expect(onSelect).toHaveBeenCalledWith("ember");
  });

  it("switches back to the local pane through both the button and the returned controller", () => {
    const { els, picker } = setup();
    picker.select("url");
    els.sourceLocalBtn.click();
    expect(shown(els)).toEqual([true, false, false]);
    expect(els.sourceLocalBtn.classList.contains("active")).toBe(true);
    expect(els.sourceUrlBtn.classList.contains("active")).toBe(false);
  });

  it("submits a trimmed URL without navigating", () => {
    const { els, onRemoteUrl } = setup();
    els.urlInput.value = "  https://example.org/electrodes.csv  ";
    const event = new Event("submit", { bubbles: true, cancelable: true });
    els.urlForm.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onRemoteUrl).toHaveBeenCalledWith("https://example.org/electrodes.csv");
  });

  it("needs no select handler", () => {
    const { els } = setup();
    const picker = initSourcePicker(els, { onRemoteUrl: vi.fn() });
    expect(() => picker.select("ember")).not.toThrow();
  });
});
