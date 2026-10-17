const ENTER_LABEL = "View MNI152 viewer full screen";
const EXIT_LABEL = "Exit full screen";

export function initViewerFullscreen(viewer: HTMLElement, button: HTMLButtonElement): () => void {
  const ownerDocument = viewer.ownerDocument;
  if (typeof viewer.requestFullscreen !== "function" || typeof ownerDocument.exitFullscreen !== "function") {
    button.hidden = true;
    return () => {};
  }

  const syncState = (): void => {
    const active = ownerDocument.fullscreenElement === viewer;
    const label = active ? EXIT_LABEL : ENTER_LABEL;
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  const toggle = (): void => {
    const operation =
      ownerDocument.fullscreenElement === viewer ? ownerDocument.exitFullscreen() : viewer.requestFullscreen();
    void operation.catch((error: unknown) => {
      console.warn("Could not change the RAVE viewer full-screen mode:", error);
    });
  };

  button.addEventListener("click", toggle);
  ownerDocument.addEventListener("fullscreenchange", syncState);
  syncState();

  return () => {
    button.removeEventListener("click", toggle);
    ownerDocument.removeEventListener("fullscreenchange", syncState);
  };
}
