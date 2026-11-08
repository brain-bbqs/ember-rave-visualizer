import { getShellElements, getWhatsNewElements, required, type ShellElementIds } from "@brain-bbqs/ui";

// This page's ids for the shared shell's elements (bbqs-uploader's kebab-case set); the package
// defaults are camelCase.
const SHELL_IDS = {
  themeToggle: "theme-toggle",
  oauthSigninBtn: "oauth-signin-btn",
  oauthSignedIn: "oauth-signed-in",
  oauthAvatar: "oauth-avatar",
  oauthUsername: "oauth-username",
  oauthSignoutBtn: "oauth-signout-btn",
} satisfies Partial<ShellElementIds>;

export function getShell() {
  const shell = getShellElements(SHELL_IDS);
  // The package looks the account menu up only when its sign-in button exists; this page always
  // has one, so a missing button is as much a broken page as any other missing id.
  if (!shell.account) throw new Error(`Expected #${SHELL_IDS.oauthSigninBtn} to exist in the document`);
  return { ...shell, account: shell.account };
}

export function getElements() {
  return {
    loadCard: required<HTMLElement>("load-card"),
    sourceTabs: required<HTMLDivElement>("source-tabs"),
    sourceLocalBtn: required<HTMLButtonElement>("source-local-btn"),
    sourceUrlBtn: required<HTMLButtonElement>("source-url-btn"),
    sourceEmberBtn: required<HTMLButtonElement>("source-ember-btn"),
    localSourcePane: required<HTMLDivElement>("local-source-pane"),
    emberSourcePane: required<HTMLDivElement>("ember-source-pane"),
    urlSourcePane: required<HTMLDivElement>("url-source-pane"),
    urlForm: required<HTMLFormElement>("url-form"),
    urlInput: required<HTMLInputElement>("url-input"),
    loadUrlBtn: required<HTMLButtonElement>("load-url-btn"),
    browseFilter: required<HTMLInputElement>("browse-filter"),
    browseStatus: required<HTMLDivElement>("browse-status"),
    browseDandisets: required<HTMLUListElement>("browse-dandisets"),
    browseTables: required<HTMLUListElement>("browse-tables"),
    browseTableHeading: required<HTMLSpanElement>("browse-table-heading"),
    browseDandisetLink: required<HTMLAnchorElement>("browse-dandiset-link"),
    browseSigninHint: required<HTMLParagraphElement>("browse-signin-hint"),
    dropzone: required<HTMLDivElement>("dropzone"),
    dropzoneReject: required<HTMLParagraphElement>("dropzone-reject"),
    browseFileBtn: required<HTMLButtonElement>("browse-file-btn"),
    fileInput: required<HTMLInputElement>("file-input"),
    loadStatus: required<HTMLDivElement>("load-status"),
    clearElectrodesBtn: required<HTMLButtonElement>("clear-electrodes-btn"),
    viewerCard: required<HTMLElement>("viewer-card"),
    viewerFullscreenBtn: required<HTMLButtonElement>("viewer-fullscreen-btn"),
    viewerFrameShell: required<HTMLDivElement>("viewer-frame-shell"),
    viewerFrame: required<HTMLIFrameElement>("viewer-frame"),
    viewerLoading: required<HTMLDivElement>("viewer-loading"),
    viewerTestPlaceholder: required<HTMLDivElement>("viewer-test-placeholder"),
    whatsNew: getWhatsNewElements(),
  };
}

export type AppElements = ReturnType<typeof getElements>;
