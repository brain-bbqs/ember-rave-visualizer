// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppElements } from "../../src/ui/elements";
import { initSourcePicker } from "../../src/ui/sourcePicker";

function setup() {
  const localButton = document.createElement("button");
  localButton.className = "primary";
  const urlButton = document.createElement("button");
  const localPane = document.createElement("div");
  const urlPane = document.createElement("div");
  urlPane.hidden = true;
  const form = document.createElement("form");
  const input = document.createElement("input");
  form.appendChild(input);
  document.body.append(localButton, urlButton, localPane, urlPane, form);
  const onRemoteUrl = vi.fn();
  const els = {
    sourceLocalBtn: localButton,
    sourceUrlBtn: urlButton,
    localSourcePane: localPane,
    urlSourcePane: urlPane,
    urlForm: form,
    urlInput: input,
  } as unknown as AppElements;
  const picker = initSourcePicker(els, onRemoteUrl);
  return { localButton, urlButton, localPane, urlPane, form, input, onRemoteUrl, picker };
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("initSourcePicker", () => {
  it("switches to and focuses the remote URL pane", () => {
    const { localButton, urlButton, localPane, urlPane, input } = setup();
    urlButton.click();

    expect(localPane.hidden).toBe(true);
    expect(urlPane.hidden).toBe(false);
    expect(localButton.classList.contains("primary")).toBe(false);
    expect(urlButton.classList.contains("primary")).toBe(true);
    expect(localButton.getAttribute("aria-pressed")).toBe("false");
    expect(urlButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(input);
  });

  it("switches back to the local pane through both the button and returned controller", () => {
    const { localButton, localPane, urlPane, picker } = setup();
    picker.select("url");
    localButton.click();
    expect(localPane.hidden).toBe(false);
    expect(urlPane.hidden).toBe(true);
    expect(localButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("submits a trimmed URL without navigating", () => {
    const { form, input, onRemoteUrl } = setup();
    input.value = "  https://example.org/electrodes.csv  ";
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onRemoteUrl).toHaveBeenCalledWith("https://example.org/electrodes.csv");
  });
});
