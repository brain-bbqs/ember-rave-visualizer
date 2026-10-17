import "./style.css";
import { initThemeToggle, initWhatsNew, renderVersion } from "@brain-bbqs/ui";
import changelog from "../CHANGELOG.md?raw";
import { readElectrodeCsv } from "./lib/electrodeCsv";
import { fetchRemoteCsv } from "./lib/remoteCsv";
import { THEME_KEY } from "./lib/settings";
import { readTestInjection, synthesizeMockCsv } from "./lib/testInjection";
import { initDropzone } from "./ui/dropzone";
import { getElements, getShell } from "./ui/elements";
import { initSourcePicker } from "./ui/sourcePicker";
import { renderLoadState } from "./ui/status";
import { createViewerBridge, type ViewerPort } from "./ui/viewer";

const shell = getShell();
const els = getElements();

renderVersion(shell.versionIndicator, __APP_VERSION__);
initWhatsNew(els.whatsNew, { changelog });
initThemeToggle(shell.themeToggle, { storageKey: THEME_KEY });

const injection = readTestInjection(window.location.search);

const fakeViewer: ViewerPort = {
  whenReady: () => Promise.resolve(),
  loadCsv: () => Promise.resolve(),
  clearElectrodes: () => Promise.resolve(),
  setBackground: () => Promise.resolve(),
  destroy: () => {},
};

let viewer: ViewerPort;
if (injection?.fakeViewer) {
  viewer = fakeViewer;
  els.viewerLoading.hidden = true;
  els.viewerTestPlaceholder.hidden = false;
  els.viewerFrame.hidden = true;
} else {
  viewer = createViewerBridge(els.viewerFrame);
  const source = els.viewerFrame.dataset.src;
  if (!source) throw new Error("The RAVE viewer source is missing.");
  els.viewerFrame.src = source;
  void viewer.whenReady().then(() => {
    els.viewerLoading.hidden = true;
  });
}

function viewerBackground(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
}

function syncViewerTheme(): void {
  void viewer.setBackground(viewerBackground()).catch((error: unknown) => {
    console.warn("Could not update the RAVE viewer theme:", error);
  });
}

void viewer.whenReady().then(syncViewerTheme);
shell.themeToggle.addEventListener("click", syncViewerTheme);

let loadSequence = 0;
let remoteRequest: AbortController | null = null;
let viewerActions = Promise.resolve();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The electrode CSV could not be loaded.";
}

function electrodeCount(count: number): string {
  return count === 1 ? "1 electrode" : count + " electrodes";
}

function queueViewerAction(action: () => Promise<void>): Promise<void> {
  const pending = viewerActions.then(action);
  viewerActions = pending.catch(() => {});
  return pending;
}

async function loadCsv(file: File, source: string, sequence: number): Promise<void> {
  try {
    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "loading",
      title: `Checking ${file.name}`,
      detail: "Validating MNI152 coordinates before opening them in RAVE.",
    });
    const summary = await readElectrodeCsv(file);
    if (sequence !== loadSequence) return;

    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "loading",
      title: `Loading ${summary.name}`,
      detail: `Preparing ${electrodeCount(summary.rowCount)} in the 3D viewer.`,
    });
    await queueViewerAction(async () => {
      if (sequence !== loadSequence) return;
      await viewer.loadCsv(file);
    });
    if (sequence !== loadSequence) return;

    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "success",
      title: `${summary.name} loaded`,
      detail: `${electrodeCount(summary.rowCount)} · ${summary.columnCount} columns · ${source}`,
    });
  } catch (error) {
    if (sequence !== loadSequence) return;
    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "error",
      title: "Could not load the electrode CSV",
      detail: errorMessage(error),
    });
  }
}

function loadLocalFile(file: File): void {
  remoteRequest?.abort();
  remoteRequest = null;
  loadSequence += 1;
  void loadCsv(file, "Local file", loadSequence);
}

async function loadRemoteUrl(input: string): Promise<void> {
  remoteRequest?.abort();
  remoteRequest = new AbortController();
  loadSequence += 1;
  const sequence = loadSequence;
  renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
    kind: "loading",
    title: "Downloading electrode CSV",
    detail: "GitHub file links are resolved through raw.githubusercontent.com.",
  });

  try {
    const remote = await fetchRemoteCsv(input, remoteRequest.signal);
    if (sequence !== loadSequence) return;
    const host = new URL(remote.downloadUrl).hostname;
    await loadCsv(remote.file, `Remote URL · ${host}`, sequence);
  } catch (error) {
    if (sequence !== loadSequence || (error instanceof DOMException && error.name === "AbortError")) return;
    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "error",
      title: "Could not download the electrode CSV",
      detail: errorMessage(error),
    });
  }
}

initDropzone(els, loadLocalFile);
const sourcePicker = initSourcePicker(els, (url) => void loadRemoteUrl(url));

els.clearElectrodesBtn.addEventListener("click", () => {
  loadSequence += 1;
  remoteRequest?.abort();
  remoteRequest = null;
  void queueViewerAction(() => viewer.clearElectrodes()).catch((error: unknown) => {
    console.warn("Could not clear the RAVE viewer:", error);
  });
  renderLoadState(els.loadStatus, els.clearElectrodesBtn, { kind: "idle" });
});

if (injection?.sourceUrl) sourcePicker.select("url");
if (injection?.mockCsv) loadLocalFile(synthesizeMockCsv());
