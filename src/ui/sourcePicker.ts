import type { AppElements } from "./elements";

export type SourcePane = "local" | "url";

export interface SourcePicker {
  select(source: SourcePane): void;
}

export function initSourcePicker(els: AppElements, onRemoteUrl: (url: string) => void): SourcePicker {
  function select(source: SourcePane): void {
    const local = source === "local";
    els.localSourcePane.hidden = !local;
    els.urlSourcePane.hidden = local;
    els.sourceLocalBtn.classList.toggle("primary", local);
    els.sourceUrlBtn.classList.toggle("primary", !local);
    els.sourceLocalBtn.setAttribute("aria-pressed", String(local));
    els.sourceUrlBtn.setAttribute("aria-pressed", String(!local));
    if (!local) els.urlInput.focus();
  }

  els.sourceLocalBtn.addEventListener("click", () => select("local"));
  els.sourceUrlBtn.addEventListener("click", () => select("url"));
  els.urlForm.addEventListener("submit", (event) => {
    event.preventDefault();
    onRemoteUrl(els.urlInput.value.trim());
  });

  return { select };
}
