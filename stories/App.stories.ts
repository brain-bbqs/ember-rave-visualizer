// Loaded as raw HTML so the stories cannot drift from the real page structure.
import indexHtml from "../index.html?raw";
import { withTheme } from "./utils";

declare const __APP_VERSION__: string;

type AppState = "default" | "url" | "loaded";
type Theme = "light" | "dark";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error("Missing story element " + selector);
  return element;
}

function applyFakeViewer(wrapper: HTMLElement): void {
  required<HTMLElement>(wrapper, "#viewer-loading").hidden = true;
  required<HTMLElement>(wrapper, "#viewer-test-placeholder").hidden = false;
  required<HTMLIFrameElement>(wrapper, "#viewer-frame").hidden = true;
}

function applyUrlState(wrapper: HTMLElement): void {
  required<HTMLElement>(wrapper, "#local-source-pane").hidden = true;
  required<HTMLElement>(wrapper, "#url-source-pane").hidden = false;
  required<HTMLButtonElement>(wrapper, "#source-local-btn").classList.remove("primary");
  required<HTMLButtonElement>(wrapper, "#source-local-btn").setAttribute("aria-pressed", "false");
  required<HTMLButtonElement>(wrapper, "#source-url-btn").classList.add("primary");
  required<HTMLButtonElement>(wrapper, "#source-url-btn").setAttribute("aria-pressed", "true");
}

function applyLoadedState(wrapper: HTMLElement): void {
  const status = required<HTMLElement>(wrapper, "#load-status");
  status.hidden = false;
  status.classList.add("success");
  const title = document.createElement("strong");
  title.textContent = "test-injection-mock-electrodes.csv loaded";
  const detail = document.createElement("span");
  detail.className = "load-status-detail";
  detail.textContent = "2 electrodes · 7 columns · Local file";
  status.replaceChildren(title, detail);
  required<HTMLButtonElement>(wrapper, "#clear-electrodes-btn").hidden = false;
}

function buildApp(theme: Theme, state: AppState): HTMLElement {
  const doc = new DOMParser().parseFromString(indexHtml, "text/html");
  doc.body.querySelectorAll("script").forEach((script) => script.remove());
  const wrapper = document.createElement("div");
  wrapper.innerHTML = doc.body.innerHTML;
  required<HTMLElement>(wrapper, "#version-indicator").textContent = "v" + __APP_VERSION__;
  applyFakeViewer(wrapper);
  if (state === "url") applyUrlState(wrapper);
  if (state === "loaded") applyLoadedState(wrapper);
  return withTheme(theme, () => wrapper);
}

export default {
  title: "App",
};

export const DefaultLight = {
  name: "Default (light)",
  render: () => buildApp("light", "default"),
};

export const DefaultDark = {
  name: "Default (dark)",
  render: () => buildApp("dark", "default"),
};

export const RemoteUrlLight = {
  name: "Remote URL (light)",
  render: () => buildApp("light", "url"),
};

export const RemoteUrlDark = {
  name: "Remote URL (dark)",
  render: () => buildApp("dark", "url"),
};

export const LoadedLight = {
  name: "CSV loaded (light)",
  render: () => buildApp("light", "loaded"),
};

export const LoadedDark = {
  name: "CSV loaded (dark)",
  render: () => buildApp("dark", "loaded"),
};
