export const RAVE_READY_MESSAGE = "ember-rave-viewer-ready";

const VIEWER_READY_TIMEOUT_MS = 60_000;

interface RaveViewerApp {
  fileLoader: {
    loadFromResponse(response: File): Promise<unknown>;
  };
  handleFileData(data: unknown, filename: string, options: { clearFirst: boolean }): Promise<string[]>;
  controllerGUI: {
    getController(name: string): { setValue(value: string): void };
  };
  canvas: {
    get_state(name: string): unknown;
    clearElectrodes(subject: unknown): void;
    needsUpdate: boolean;
  };
}

type RaveWindow = Window & typeof globalThis & { raveViewerApp?: RaveViewerApp };

export interface ViewerPort {
  whenReady(): Promise<void>;
  loadCsv(file: File): Promise<void>;
  clearElectrodes(): Promise<void>;
  setBackground(color: string): Promise<void>;
  destroy(): void;
}

function timeoutAfter(milliseconds: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("The RAVE viewer did not become ready in time.")), milliseconds);
  });
}

export function createViewerBridge(frame: HTMLIFrameElement): ViewerPort {
  let ready = false;
  let resolveReady: (() => void) | undefined;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function app(): RaveViewerApp | undefined {
    return (frame.contentWindow as RaveWindow | null)?.raveViewerApp;
  }

  function acceptReady(): void {
    if (ready || !app()) return;
    ready = true;
    resolveReady?.();
  }

  function onMessage(event: MessageEvent<unknown>): void {
    if (event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
    if (typeof event.data !== "object" || event.data === null || !("type" in event.data)) return;
    if ((event.data as { type?: unknown }).type === RAVE_READY_MESSAGE) acceptReady();
  }

  window.addEventListener("message", onMessage);
  frame.addEventListener("load", acceptReady);
  acceptReady();

  async function requireApp(): Promise<RaveViewerApp> {
    if (!ready) await Promise.race([readyPromise, timeoutAfter(VIEWER_READY_TIMEOUT_MS)]);
    const current = app();
    if (!current) throw new Error("The RAVE viewer is unavailable.");
    return current;
  }

  return {
    whenReady: () => readyPromise,
    async loadCsv(file): Promise<void> {
      const current = await requireApp();
      const data = await current.fileLoader.loadFromResponse(file);
      const handlers = await current.handleFileData(data, file.name, { clearFirst: true });
      if (!handlers.includes("ElectrodeCoordinateHandler")) {
        throw new Error("RAVE did not recognize this CSV as an electrode coordinate table.");
      }
    },
    async clearElectrodes(): Promise<void> {
      const current = await requireApp();
      current.canvas.clearElectrodes(current.canvas.get_state("target_subject"));
      current.canvas.needsUpdate = true;
    },
    async setBackground(color): Promise<void> {
      const current = await requireApp();
      current.controllerGUI.getController("Background Color").setValue(color);
    },
    destroy(): void {
      window.removeEventListener("message", onMessage);
    },
  };
}
