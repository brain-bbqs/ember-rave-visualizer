// Typed lookups for the static skeleton markup in index.html. Every id the app touches is
// registered here, so a renamed or dropped element fails on import (and in the boot smoke test)
// rather than as a null dereference somewhere down the page.
import { getShellElements, getWhatsNewElements, required } from "@brain-bbqs/ui";

/** The shell's theme toggle and version stamp, looked up by @brain-bbqs/ui (no account menu here). */
export function getShell() {
  return getShellElements({ themeToggle: "theme-toggle" });
}

export function getElements() {
  return {
    loadCard: required<HTMLElement>("load-card"),
    dropzone: required<HTMLDivElement>("dropzone"),
    dropzoneReject: required<HTMLParagraphElement>("dropzone-reject"),
    browseFileBtn: required<HTMLButtonElement>("browse-file-btn"),
    fileInput: required<HTMLInputElement>("file-input"),
    fileCard: required<HTMLElement>("file-card"),
    fileSummaryName: required<HTMLSpanElement>("file-summary-name"),
    fileSummaryStats: required<HTMLSpanElement>("file-summary-stats"),
    changeFileBtn: required<HTMLButtonElement>("change-file-btn"),
    whatsNew: getWhatsNewElements(),
  };
}

export type AppElements = ReturnType<typeof getElements>;
