import { describe, expect, it, vi } from "vitest";
import { VIEWER_ADAPTER } from "../../scripts/raveViewerData";

const ORIGIN = "https://example.org";
const FRAME = { width: 1366, height: 838 };
// The engine's docked layout leaves the canvas the frame's width less the control panel's 300px,
// and frames 300 world units across that width.
const DOCKED = FRAME.width - 300;
const DOCKED_HEIGHT = (FRAME.height * DOCKED) / FRAME.width;

function setup() {
  const folders = [{ close: vi.fn() }, { close: vi.fn() }];
  const uploader = { hide: vi.fn() };
  const app = {
    controllerGUI: { folders, getController: vi.fn(() => uploader) },
    controllerClosed: false,
    $wrapper: { clientWidth: FRAME.width, clientHeight: FRAME.height },
    $settingsPanel: { offsetWidth: 300, style: { maxHeight: "" } },
    resize: vi.fn(),
  };
  const engineResize = app.resize;
  // As the engine sizes it for a full-width canvas: 300 units across, the same scale up and down.
  const camera = {
    left: -150,
    right: 150,
    top: (150 * FRAME.height) / FRAME.width,
    bottom: (-150 * FRAME.height) / FRAME.width,
    zoom: 1,
    view: null as Record<string, number | boolean> | null,
    position: { x: 500, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    setViewOffset: vi.fn(
      (fullWidth: number, fullHeight: number, offsetX: number, offsetY: number, width: number, height: number) => {
        camera.view = { enabled: true, fullWidth, fullHeight, offsetX, offsetY, width, height };
      },
    ),
  };
  const at = { x: 0, y: 0, z: 0 };
  const compass = {
    container: { visible: true, position: at },
    rulerContainer: { position: { x: 0, y: 0, z: 0, copy: vi.fn() } },
    ruler: { position: { x: 0 } },
    rulerMeasure: { position: { x: 25 } },
    // Like the engine: in front of the camera, 10 compass units in from the corner of its unshifted
    // frustum. Looking along -x with z up, the camera's right axis is +y and its up axis +z.
    update: vi.fn(() => {
      Object.assign(at, { x: 460, y: (camera.left + 10) / camera.zoom, z: (camera.bottom + 10) / camera.zoom });
    }),
  };
  const engineUpdate = compass.update;
  // Before the adapter runs, the engine has docked the control panel beside a narrower canvas.
  const canvas = {
    main_canvas: { clientWidth: FRAME.width - 300, clientHeight: FRAME.height },
    side_width: 250,
    sideCanvasEnabled: true,
    mainCamera: camera,
    compass,
    trackball: { target: { x: 0, y: 0, z: 0 } },
    needsUpdate: false,
    handle_resize: vi.fn((width: number, height: number) => {
      Object.assign(canvas.main_canvas, { clientWidth: width, clientHeight: height });
    }),
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
  return {
    app,
    engineResize,
    canvas,
    compass,
    engineUpdate,
    at,
    folders,
    uploader,
    originals,
    observers,
    page,
    run,
    lastOffset,
  };
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

  it("runs the canvas the frame's full width, under the control panel, in place of the engine's docked layout", () => {
    const { app, engineResize, canvas, run } = setup();
    run();
    expect(canvas.handle_resize).toHaveBeenLastCalledWith(FRAME.width, FRAME.height);
    expect(app.$settingsPanel.style.maxHeight).toBe(`${FRAME.height}px`);

    app.resize(1700, 900);
    expect(canvas.handle_resize).toHaveBeenLastCalledWith(1700, 900);
    expect(engineResize).not.toHaveBeenCalled();
  });

  it("ignores a resize to no size", () => {
    const { app, canvas, run } = setup();
    run();
    const calls = canvas.handle_resize.mock.calls.length;
    app.resize(0, 900);
    expect(canvas.handle_resize.mock.calls).toHaveLength(calls);
  });

  it("frames the brain at its docked size, centred between the slice panels and the control panel's column", () => {
    const { canvas, run, lastOffset } = setup();
    run();
    const dockedOffset = [DOCKED, DOCKED_HEIGHT, -125, (DOCKED_HEIGHT - FRAME.height) / 2, FRAME.width, FRAME.height];
    expect(lastOffset()).toEqual(dockedOffset);
    expect(canvas.needsUpdate).toBe(true);
  });

  it("re-frames when the slice panels or the control panel are hidden or shown again", () => {
    const { app, canvas, originals, run, lastOffset } = setup();
    run();
    canvas.disableSideCanvas();
    expect(originals.disable).toHaveBeenCalled();
    expect(lastOffset()?.slice(0, 3)).toEqual([DOCKED, DOCKED_HEIGHT, -0]);
    canvas.enableSideCanvas();
    expect(originals.enable).toHaveBeenCalled();
    expect(lastOffset()?.slice(0, 3)).toEqual([DOCKED, DOCKED_HEIGHT, -125]);
    // The engine resizes when its control panel opens or closes.
    app.controllerClosed = true;
    app.resize(FRAME.width, FRAME.height);
    expect(lastOffset()).toEqual([FRAME.width, FRAME.height, -125, 0, FRAME.width, FRAME.height]);
  });

  it("frames a frame too narrow to spare the control panel its column across its full width", () => {
    const { app, run, lastOffset } = setup();
    run();
    app.resize(500, FRAME.height);
    expect(lastOffset()).toEqual([500, FRAME.height, -125, 0, 500, FRAME.height]);
  });

  it("re-frames on resize and skips a canvas with no size", () => {
    const { canvas, observers, run, lastOffset } = setup();
    run();
    canvas.main_canvas.clientWidth = 1700;
    observers[0]();
    expect(lastOffset()?.slice(0, 2)).toEqual([1400, (FRAME.height * 1400) / 1700]);

    const calls = canvas.mainCamera.setViewOffset.mock.calls.length;
    canvas.main_canvas.clientWidth = 0;
    observers[0]();
    expect(canvas.mainCamera.setViewOffset.mock.calls).toHaveLength(calls);
  });

  it.each([1, 2])(
    "moves the compass to the bottom-right corner, clear of the full-screen button, at zoom %d",
    (zoom) => {
      const { canvas, compass, engineUpdate, at, run } = setup();
      run();
      canvas.mainCamera.zoom = zoom;
      compass.update();
      expect(engineUpdate).toHaveBeenCalled();
      // The view centre sits at (658, 419) on screen, between the slice panels and the panel column.
      const unitsPerPixel = 300 / (DOCKED * zoom);
      const centreX = (DOCKED + 250) / 2;
      expect(at.y).toBeCloseTo((FRAME.width - centreX - 44) * unitsPerPixel - 13 / zoom);
      expect(at.z).toBeCloseTo((-FRAME.height / 2) * unitsPerPixel + 10 / zoom);
      expect(at.x).toBeCloseTo(460);
      expect(compass.rulerContainer.position.copy).toHaveBeenLastCalledWith(at);
    },
  );

  it("puts the scale bar on the compass's left, mirroring the engine's layout", () => {
    const { compass, run } = setup();
    run();
    expect([compass.ruler.position.x, compass.rulerMeasure.position.x]).toEqual([-50, -25]);
  });

  it("leaves a hidden compass where the engine put it", () => {
    const { compass, at, run } = setup();
    run();
    compass.container.visible = false;
    compass.update();
    expect([at.y, at.z]).toEqual([-140, (-150 * FRAME.height) / FRAME.width + 10]);
    expect(compass.rulerContainer.position.copy).not.toHaveBeenCalled();
  });

  it("installs the layout and the compass move once even if the engine runs the adapter again", () => {
    const { canvas, compass, observers, run } = setup();
    run();
    run();
    expect(observers).toHaveLength(1);
    expect(compass.ruler.position.x).toBe(-50);
    const calls = canvas.mainCamera.setViewOffset.mock.calls.length;
    canvas.enableSideCanvas();
    expect(canvas.mainCamera.setViewOffset.mock.calls).toHaveLength(calls + 1);
  });
});
