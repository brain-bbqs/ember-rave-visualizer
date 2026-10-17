// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createViewerBridge, RAVE_READY_MESSAGE } from "../../src/ui/viewer";

function raveApp(recognized = true) {
  return {
    fileLoader: { loadFromResponse: vi.fn(async () => ({ parsed: true })) },
    handleFileData: vi.fn(async () => (recognized ? ["ElectrodeCoordinateHandler"] : ["OtherHandler"])),
    controllerGUI: { getController: vi.fn(() => ({ setValue: vi.fn() })) },
    canvas: {
      get_state: vi.fn(() => "subject-code"),
      clearElectrodes: vi.fn(),
      needsUpdate: false,
    },
  };
}

function setup(app = raveApp()) {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const viewerWindow = frame.contentWindow as Window & { raveViewerApp?: ReturnType<typeof raveApp> };
  Object.defineProperty(viewerWindow, "raveViewerApp", { configurable: true, value: app, writable: true });
  return { frame, viewerWindow, app };
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("createViewerBridge", () => {
  it("uses the registered RAVE app to load a CSV", async () => {
    const { frame, app } = setup();
    const bridge = createViewerBridge(frame);
    const file = new File(["csv"], "subject.csv");
    await expect(bridge.whenReady()).resolves.toBeUndefined();
    await bridge.loadCsv(file);
    expect(app.fileLoader.loadFromResponse).toHaveBeenCalledWith(file);
    expect(app.handleFileData).toHaveBeenCalledWith({ parsed: true }, "subject.csv", { clearFirst: true });
  });

  it("reports a table RAVE does not recognize as electrode coordinates", async () => {
    const { frame } = setup(raveApp(false));
    const bridge = createViewerBridge(frame);
    await expect(bridge.loadCsv(new File(["csv"], "other.csv"))).rejects.toThrow("did not recognize");
  });

  it("clears the target subject and updates the canvas", async () => {
    const { frame, app } = setup();
    const bridge = createViewerBridge(frame);
    await bridge.clearElectrodes();
    expect(app.canvas.get_state).toHaveBeenCalledWith("target_subject");
    expect(app.canvas.clearElectrodes).toHaveBeenCalledWith("subject-code");
    expect(app.canvas.needsUpdate).toBe(true);
  });

  it("sets the viewer background through its registered controller", async () => {
    const { frame, app } = setup();
    const controller = { setValue: vi.fn() };
    app.controllerGUI.getController.mockReturnValue(controller);
    const bridge = createViewerBridge(frame);
    await bridge.setBackground("rgb(1, 2, 3)");
    expect(app.controllerGUI.getController).toHaveBeenCalledWith("Background Color");
    expect(controller.setValue).toHaveBeenCalledWith("rgb(1, 2, 3)");
  });

  it("waits for the same-origin ready event when the app registers later", async () => {
    const app = raveApp();
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const viewerWindow = frame.contentWindow as Window & { raveViewerApp?: ReturnType<typeof raveApp> };
    const bridge = createViewerBridge(frame);

    window.dispatchEvent(
      new MessageEvent("message", {
        source: viewerWindow,
        origin: "https://not-this-page.example",
        data: { type: RAVE_READY_MESSAGE },
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: viewerWindow,
        origin: window.location.origin,
        data: null,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: viewerWindow,
        origin: window.location.origin,
        data: {},
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        source: viewerWindow,
        origin: window.location.origin,
        data: { type: "something-else" },
      }),
    );
    Object.defineProperty(viewerWindow, "raveViewerApp", { configurable: true, value: app, writable: true });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: viewerWindow,
        origin: window.location.origin,
        data: { type: RAVE_READY_MESSAGE },
      }),
    );
    await expect(bridge.whenReady()).resolves.toBeUndefined();
    frame.dispatchEvent(new Event("load"));
  });

  it("also detects a viewer that registers before its iframe load event", async () => {
    const app = raveApp();
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    const viewerWindow = frame.contentWindow as Window & { raveViewerApp?: ReturnType<typeof raveApp> };
    const bridge = createViewerBridge(frame);
    Object.defineProperty(viewerWindow, "raveViewerApp", { configurable: true, value: app });
    frame.dispatchEvent(new Event("load"));
    await expect(bridge.whenReady()).resolves.toBeUndefined();
  });

  it("removes its window listener when destroyed", () => {
    const { frame } = setup();
    const remove = vi.spyOn(window, "removeEventListener");
    const bridge = createViewerBridge(frame);
    bridge.destroy();
    expect(remove).toHaveBeenCalledWith("message", expect.any(Function));
    remove.mockRestore();
  });

  it("fails if a ready viewer subsequently becomes unavailable", async () => {
    const { frame, viewerWindow } = setup();
    const bridge = createViewerBridge(frame);
    delete (viewerWindow as Window & { raveViewerApp?: unknown }).raveViewerApp;
    await expect(bridge.loadCsv(new File(["csv"], "subject.csv"))).rejects.toThrow("viewer is unavailable");
  });

  it("times out an operation if the viewer never registers", async () => {
    vi.useFakeTimers();
    try {
      const frame = document.createElement("iframe");
      document.body.appendChild(frame);
      const bridge = createViewerBridge(frame);
      const result = expect(bridge.loadCsv(new File(["csv"], "subject.csv"))).rejects.toThrow(
        "did not become ready in time",
      );
      await vi.advanceTimersByTimeAsync(60_000);
      await result;
      bridge.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
