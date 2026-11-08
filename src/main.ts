import "./style.css";
import {
  fetchArchiveUser,
  resolveConfig,
  type ArchiveConfig,
  type ArchiveUser,
  type OAuthTokenSet,
} from "@brain-bbqs/ember-client";
import {
  bindAccountMenu,
  initThemeToggle,
  initWhatsNew,
  refreshIdentity,
  renderAuthState,
  renderIdentity,
  renderVersion,
} from "@brain-bbqs/ui";
import changelog from "../CHANGELOG.md?raw";
import { tableFileName, tableRefusal, type ArchiveTable } from "./lib/archives";
import { readElectrodeTable } from "./lib/electrodeTable";
import { downloadEmbargoedTable } from "./lib/embargoed";
import { oauth } from "./lib/oauth";
import { downloadTableFile, fetchRemoteTable } from "./lib/remoteTable";
import { settingsStore, THEME_KEY } from "./lib/settings";
import { FAKE_ACCOUNT, fakeArchiveBrowse, readTestInjection, synthesizeMockTable } from "./lib/testInjection";
import { createBrowsePane } from "./ui/browsePane";
import { initDropzone } from "./ui/dropzone";
import { getElements, getShell } from "./ui/elements";
import { initViewerFullscreen } from "./ui/fullscreen";
import { initSourcePicker } from "./ui/sourcePicker";
import { renderLoadState } from "./ui/status";
import { createViewerBridge, type ViewerPort } from "./ui/viewer";

const shell = getShell();
const account = shell.account;
const els = getElements();

renderVersion(shell.versionIndicator, __APP_VERSION__);
initWhatsNew(els.whatsNew, { changelog });
initThemeToggle(shell.themeToggle, { storageKey: THEME_KEY });
initViewerFullscreen(els.viewerCard, els.viewerFullscreenBtn);

const injection = readTestInjection(window.location.search);

const fakeViewer: ViewerPort = {
  whenReady: () => Promise.resolve(),
  loadTable: () => Promise.resolve(),
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
  return error instanceof Error ? error.message : "The electrode table could not be loaded.";
}

function electrodeCount(count: number): string {
  return count === 1 ? "1 electrode" : count + " electrodes";
}

function queueViewerAction(action: () => Promise<void>): Promise<void> {
  const pending = viewerActions.then(action);
  viewerActions = pending.catch(() => {});
  return pending;
}

async function loadTable(file: File, source: string, sequence: number): Promise<void> {
  try {
    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "loading",
      title: `Checking ${file.name}`,
      detail: "Validating MNI152 coordinates before opening them in RAVE.",
    });
    const summary = await readElectrodeTable(file);
    if (sequence !== loadSequence) return;

    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "loading",
      title: `Loading ${summary.name}`,
      detail: `Preparing ${electrodeCount(summary.rowCount)} in the 3D viewer.`,
    });
    await queueViewerAction(async () => {
      if (sequence !== loadSequence) return;
      await viewer.loadTable(file);
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
      title: "Could not load the electrode table",
      detail: errorMessage(error),
    });
  }
}

function loadLocalFile(file: File): void {
  remoteRequest?.abort();
  remoteRequest = null;
  loadSequence += 1;
  void loadTable(file, "Local file", loadSequence);
}

/** Downloads a table, then loads it like a local file. Any download already running is abandoned. */
async function downloadAndLoad(
  loading: { title: string; detail: string },
  download: (signal: AbortSignal) => Promise<{ file: File; source: string }>,
): Promise<void> {
  remoteRequest?.abort();
  const request = new AbortController();
  remoteRequest = request;
  loadSequence += 1;
  const sequence = loadSequence;
  renderLoadState(els.loadStatus, els.clearElectrodesBtn, { kind: "loading", ...loading });

  try {
    const { file, source } = await download(request.signal);
    if (sequence !== loadSequence) return;
    await loadTable(file, source, sequence);
  } catch (error) {
    if (sequence !== loadSequence || (error instanceof DOMException && error.name === "AbortError")) return;
    renderLoadState(els.loadStatus, els.clearElectrodesBtn, {
      kind: "error",
      title: "Could not download the electrode table",
      detail: errorMessage(error),
    });
  }
}

function loadRemoteUrl(input: string): Promise<void> {
  return downloadAndLoad(
    {
      title: "Downloading electrode table",
      detail: "GitHub file links are resolved through raw.githubusercontent.com.",
    },
    async (signal) => {
      const remote = await fetchRemoteTable(input, signal);
      return { file: remote.file, source: `Remote URL · ${new URL(remote.downloadUrl).hostname}` };
    },
  );
}

function loadArchiveTable(table: ArchiveTable): Promise<void> {
  const name = tableFileName(table);
  return downloadAndLoad(
    { title: `Downloading ${name} from EMBER`, detail: `Dandiset ${table.dandisetId} · ${table.path}` },
    async (signal) => {
      const refusal = tableRefusal(table);
      if (refusal) throw new Error(refusal);
      let file: File;
      if (table.downloadUrl) {
        file = await downloadTableFile(table.downloadUrl, name, { signal });
      } else {
        if (!oauthTokens) throw new Error("Sign in with EMBER to load this embargoed table.");
        await ensureFreshOAuth();
        file = await downloadEmbargoedTable(archiveConfig(), table, signal);
      }
      return { file, source: `EMBER · ${table.dandisetId}` };
    },
  );
}

// ============================================================
// EMBER sign-in (mirrors clip-extractor)
// ============================================================
// Authorization Code + PKCE against the EMBER archive through @brain-bbqs/ember-client, with the
// header's account menu from @brain-bbqs/ui. The token set persists in localStorage (see
// SECURITY.md); nothing here writes to storage unless a real sign-in or sign-out happens.

let oauthTokens: OAuthTokenSet | null = settingsStore.load()?.oauth ?? null;
// Resolved once for the header and reused by the browse pane's ownership check.
let currentUser: ArchiveUser | null = null;

function saveSettings(): void {
  settingsStore.save({ oauth: oauthTokens ?? undefined });
}

/** Whether every auth-dependent surface reads as signed in: real tokens, or `?test&signed_in`.
 * `?test&signed_out` forces false without touching a real stored token. */
function isSignedIn(): boolean {
  if (injection?.signedOut) return false;
  return injection?.signedIn === true || oauthTokens !== null;
}

function archiveConfig(): ArchiveConfig {
  return resolveConfig({ dandisetId: "", oauthAccessToken: oauthTokens?.accessToken });
}

/** Refreshes the access token when it is near expiry, so the call that follows carries a live one. */
async function ensureFreshOAuth(): Promise<void> {
  if (!oauthTokens) return;
  const current = oauthTokens;
  const fresh = await oauth.ensureFreshToken(current).catch(() => current);
  // Kept only if nobody signed out while the refresh was in flight.
  if (fresh !== current && oauthTokens === current) {
    oauthTokens = fresh;
    saveSettings();
  }
}

function renderAuthUI(): void {
  const signedIn = isSignedIn();
  // Also retires the pre-paint script's stand-in attribute (see configs/vite.config.ts).
  renderAuthState(account, signedIn);
  els.browseSigninHint.hidden = signedIn;
}

async function refreshAccount(): Promise<void> {
  if (injection?.signedIn) {
    renderIdentity(account, FAKE_ACCOUNT);
    return;
  }
  if (!isSignedIn()) return;
  await ensureFreshOAuth();
  currentUser = (await refreshIdentity(account, () => fetchArchiveUser(archiveConfig()))) ?? currentUser;
}

/** Finishes a sign-in landing on this load: the archive's redirect back arrives carrying a `code`. */
async function resumeSignIn(): Promise<void> {
  const tokens = await oauth.handleRedirectCallback().catch((error: unknown) => {
    console.error("EMBER sign-in callback failed:", error);
    return null;
  });
  if (tokens) {
    oauthTokens = tokens;
    saveSettings();
  }
}

const browsePane = createBrowsePane(els, {
  config: archiveConfig,
  signedIn: isSignedIn,
  hasToken: () => isSignedIn() && oauthTokens !== null,
  ensureFreshToken: ensureFreshOAuth,
  username: async (cfg) => (currentUser ??= await fetchArchiveUser(cfg))?.username ?? "",
  fakeListing: () =>
    injection?.remoteListing != null ? fakeArchiveBrowse(injection.remoteListing, isSignedIn()) : null,
  openTable: (table) => void loadArchiveTable(table),
});

bindAccountMenu(account, {
  onSignIn: () => void oauth.startLogin(),
  onSignOut: () => {
    const tokens = oauthTokens;
    oauthTokens = null;
    currentUser = null;
    saveSettings();
    renderAuthUI();
    if (tokens) void oauth.revokeToken(tokens);
    browsePane.syncToAuth();
  },
});

const signInReady = resumeSignIn();
renderAuthUI();
void signInReady.then(() => {
  renderAuthUI();
  browsePane.syncToAuth();
  return refreshAccount();
});

initDropzone(els, loadLocalFile);
// Reading the archive costs a bucket listing and a manifest per dataset, so nothing is read until
// somebody opens the pane, and not before a sign-in landing on this load has finished.
let browseOpened: Promise<void> | null = null;
const sourcePicker = initSourcePicker(els, {
  onRemoteUrl: (url) => void loadRemoteUrl(url),
  onSelect: (source) => {
    if (source === "ember") browseOpened ??= signInReady.then(() => browsePane.refresh());
  },
});

els.clearElectrodesBtn.addEventListener("click", () => {
  loadSequence += 1;
  remoteRequest?.abort();
  remoteRequest = null;
  void queueViewerAction(() => viewer.clearElectrodes()).catch((error: unknown) => {
    console.warn("Could not clear the RAVE viewer:", error);
  });
  renderLoadState(els.loadStatus, els.clearElectrodesBtn, { kind: "idle" });
});

if (injection?.sourceEmber) sourcePicker.select("ember");
if (injection?.sourceUrl) sourcePicker.select("url");
if (injection?.mockTable) loadLocalFile(synthesizeMockTable());
