import type { AppElements } from "./elements";

export type SourcePane = "local" | "ember" | "url";

export type SourcePickerElements = Pick<
  AppElements,
  | "sourceLocalBtn"
  | "sourceEmberBtn"
  | "sourceUrlBtn"
  | "localSourcePane"
  | "emberSourcePane"
  | "urlSourcePane"
  | "urlForm"
  | "urlInput"
>;

export interface SourcePickerHandlers {
  onRemoteUrl: (url: string) => void;
  /** Called on every switch, so a pane that costs something to fill can wait until it is shown. */
  onSelect?: (source: SourcePane) => void;
}

export interface SourcePicker {
  select(source: SourcePane): void;
}

export function initSourcePicker(els: SourcePickerElements, handlers: SourcePickerHandlers): SourcePicker {
  const sources: [SourcePane, HTMLButtonElement, HTMLElement][] = [
    ["local", els.sourceLocalBtn, els.localSourcePane],
    ["ember", els.sourceEmberBtn, els.emberSourcePane],
    ["url", els.sourceUrlBtn, els.urlSourcePane],
  ];

  function select(source: SourcePane): void {
    for (const [name, button, pane] of sources) {
      const active = name === source;
      pane.hidden = !active;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (source === "url") els.urlInput.focus();
    handlers.onSelect?.(source);
  }

  for (const [name, button] of sources) button.addEventListener("click", () => select(name));
  els.urlForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onRemoteUrl(els.urlInput.value.trim());
  });

  return { select };
}
