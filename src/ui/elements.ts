import { getShellElements, getWhatsNewElements, required } from "@brain-bbqs/ui";

export function getShell() {
  return getShellElements({ themeToggle: "theme-toggle" });
}

export function getElements() {
  return {
    loadCard: required<HTMLElement>("load-card"),
    sourceTabs: required<HTMLDivElement>("source-tabs"),
    sourceLocalBtn: required<HTMLButtonElement>("source-local-btn"),
    sourceUrlBtn: required<HTMLButtonElement>("source-url-btn"),
    sourceEmberBtn: required<HTMLButtonElement>("source-ember-btn"),
    localSourcePane: required<HTMLDivElement>("local-source-pane"),
    urlSourcePane: required<HTMLDivElement>("url-source-pane"),
    urlForm: required<HTMLFormElement>("url-form"),
    urlInput: required<HTMLInputElement>("url-input"),
    loadUrlBtn: required<HTMLButtonElement>("load-url-btn"),
    dropzone: required<HTMLDivElement>("dropzone"),
    dropzoneReject: required<HTMLParagraphElement>("dropzone-reject"),
    browseFileBtn: required<HTMLButtonElement>("browse-file-btn"),
    fileInput: required<HTMLInputElement>("file-input"),
    loadStatus: required<HTMLDivElement>("load-status"),
    clearElectrodesBtn: required<HTMLButtonElement>("clear-electrodes-btn"),
    viewerCard: required<HTMLElement>("viewer-card"),
    viewerFrameShell: required<HTMLDivElement>("viewer-frame-shell"),
    viewerFrame: required<HTMLIFrameElement>("viewer-frame"),
    viewerLoading: required<HTMLDivElement>("viewer-loading"),
    viewerTestPlaceholder: required<HTMLDivElement>("viewer-test-placeholder"),
    whatsNew: getWhatsNewElements(),
  };
}

export type AppElements = ReturnType<typeof getElements>;
