export type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; title: string; detail?: string }
  | { kind: "success"; title: string; detail: string }
  | { kind: "error"; title: string; detail: string };

export function renderLoadState(status: HTMLElement, clearButton: HTMLButtonElement, state: LoadState): void {
  status.replaceChildren();
  status.classList.remove("loading", "success", "error");
  clearButton.hidden = state.kind !== "success";
  if (state.kind === "idle") {
    status.hidden = true;
    return;
  }

  status.hidden = false;
  status.classList.add(state.kind);
  const title = document.createElement("strong");
  title.textContent = state.title;
  status.appendChild(title);
  if (state.detail) {
    const detail = document.createElement("span");
    detail.className = "load-status-detail";
    detail.textContent = state.detail;
    status.appendChild(detail);
  }
}
