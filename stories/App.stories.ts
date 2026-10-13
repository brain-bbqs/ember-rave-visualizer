// Loaded via Vite's `?raw` import so this story always mirrors the real markup in index.html
// instead of a hand-maintained copy that can drift out of sync.
import indexHtml from "../index.html?raw";

// Injected by configs/storybook/main.ts, the same way vite.config.ts injects it for the real app.
declare const __APP_VERSION__: string;

interface AppStoryOptions {
  fileLoaded?: boolean;
}

// Mirrors what main.ts renders once a file is loaded (see showLoadedFile there). Storybook runs
// none of the app's script, so the story fills in the same elements by hand.
function applyFileLoaded(wrapper: HTMLElement): void {
  wrapper.querySelector("#load-card")?.setAttribute("hidden", "");
  wrapper.querySelector("#file-card")?.removeAttribute("hidden");
  const name = wrapper.querySelector("#file-summary-name");
  if (name) name.textContent = "recording.mp4";
  const stats = wrapper.querySelector("#file-summary-stats");
  if (stats) stats.textContent = "1.5 GB · video/mp4";
}

function buildApp({ fileLoaded = false }: AppStoryOptions = {}): HTMLElement {
  const doc = new DOMParser().parseFromString(indexHtml, "text/html");
  // The app's own <script type="module"> wires up real behavior; Storybook only needs the static
  // markup for a visual snapshot of each state.
  doc.body.querySelectorAll("script").forEach((s) => s.remove());
  const wrapper = document.createElement("div");
  wrapper.innerHTML = doc.body.innerHTML;
  // Mirrors the one line of main.ts that runs before anything is loaded; without it the footer's
  // version link would render as an empty (invisible) anchor in the snapshots.
  const version = wrapper.querySelector("#version-indicator");
  if (version) version.textContent = `v${__APP_VERSION__}`;
  if (fileLoaded) applyFileLoaded(wrapper);
  return wrapper;
}

export default {
  title: "App",
};

export const Default = {
  name: "Default (nothing loaded)",
  render: () => buildApp(),
};

export const FileLoaded = {
  name: "File loaded",
  render: () => buildApp({ fileLoaded: true }),
};
