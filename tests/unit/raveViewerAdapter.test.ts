import { describe, expect, it, vi } from "vitest";
import { VIEWER_ADAPTER } from "../../scripts/raveViewerData";

const ORIGIN = "https://example.org";

function setup() {
  const folders = [{ close: vi.fn() }, { close: vi.fn() }];
  const uploader = { hide: vi.fn() };
  const app = { controllerGUI: { folders, getController: vi.fn(() => uploader) } };
  const canvas = {
    main_canvas: { clientWidth: 1066, clientHeight: 838 },
    side_width: 250,
    sideCanvasEnabled: true,
    mainCamera: { setViewOffset: vi.fn() },
    needsUpdate: false,
    enableSideCanvas: vi.fn(() => {
      canvas.sideCanvasEnabled = true;
    }),
    disableSideCanvas: vi.fn(() => {
      canvas.sideCanvasEnabled = false;
    }),
  };
  const originals = { enable: canvas.enableSideCanvas, disable: canvas.disableSideCanvas };
  const observers: (() => void)[] = [];
  class FakeResizeObserver {
    constructor(callback: () => void) {
      observers.push(callback);
    }
    observe = vi.fn();
  }
  const page: {
    raveViewerApp?: unknown;
    parent: { postMessage: ReturnType<typeof vi.fn> };
    location: { origin: string };
  } = { parent: { postMessage: vi.fn() }, location: { origin: ORIGIN } };
  // The engine evaluates the adapter with `app` and `canvas` in scope; run it against stand-ins.
  const run = (): void => {
    new Function("app", "canvas", "window", "ResizeObserver", VIEWER_ADAPTER)(app, canvas, page, FakeResizeObserver);
  };
  const lastOffset = (): unknown[] | undefined => canvas.mainCamera.setViewOffset.mock.calls.at(-1);
  return { app, canvas, folders, uploader, originals, observers, page, run, lastOffset };
}

describe("viewer adapter", () => {
  it("exposes the app, hides the engine's uploader, collapses every section and announces readiness", () => {
    const { app, folders, uploader, page, run } = setup();
    run();
    expect(page.raveViewerApp).toBe(app);
    expect(app.controllerGUI.getController).toHaveBeenCalledWith("Dragdrop Uploader");
    expect(uploader.hide).toHaveBeenCalled();
    for (const folder of folders) expect(folder.close).toHaveBeenCalled();
    expect(page.parent.postMessage).toHaveBeenCalledWith({ type: "ember-rave-viewer-ready" }, ORIGIN);
  });

  it("offsets the main view by half the slice panels' width", () => {
    const { canvas, run, lastOffset } = setup();
    run();
    expect(lastOffset()).toEqual([1066, 838, -125, 0, 1066, 838]);
    expect(canvas.needsUpdate).toBe(true);
  });

  it("re-centres when the slice panels are hidden or shown again", () => {
    const { canvas, originals, run, lastOffset } = setup();
    run();
    canvas.disableSideCanvas();
    expect(originals.disable).toHaveBeenCalled();
    expect(lastOffset()).toEqual([1066, 838, -0, 0, 1066, 838]);
    canvas.enableSideCanvas();
    expect(originals.enable).toHaveBeenCalled();
    expect(lastOffset()).toEqual([1066, 838, -125, 0, 1066, 838]);
  });

  it("re-centres on resize and skips a canvas with no size", () => {
    const { canvas, observers, run, lastOffset } = setup();
    run();
    canvas.main_canvas.clientWidth = 1700;
    observers[0]();
    expect(lastOffset()).toEqual([1700, 838, -125, 0, 1700, 838]);

    const calls = canvas.mainCamera.setViewOffset.mock.calls.length;
    canvas.main_canvas.clientWidth = 0;
    observers[0]();
    expect(canvas.mainCamera.setViewOffset.mock.calls).toHaveLength(calls);
  });

  it("installs the centring once even if the engine runs the adapter again", () => {
    const { canvas, observers, run } = setup();
    run();
    run();
    expect(observers).toHaveLength(1);
    const calls = canvas.mainCamera.setViewOffset.mock.calls.length;
    canvas.enableSideCanvas();
    expect(canvas.mainCamera.setViewOffset.mock.calls).toHaveLength(calls + 1);
  });
});
