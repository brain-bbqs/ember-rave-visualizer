// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initViewerFullscreen } from "../../src/ui/fullscreen";

let cleanup = (): void => {};

function elements(): { button: HTMLButtonElement; viewer: HTMLElement } {
  document.body.innerHTML = `
    <section id="viewer"></section>
    <button type="button" aria-pressed="false">Full screen</button>
  `;
  const viewer = document.querySelector<HTMLElement>("#viewer");
  const button = document.querySelector<HTMLButtonElement>("button");
  if (!viewer || !button) throw new Error("Fullscreen test elements are missing.");
  return { button, viewer };
}

function installFullscreen(viewer: HTMLElement): {
  exitFullscreen: ReturnType<typeof vi.fn>;
  requestFullscreen: ReturnType<typeof vi.fn>;
  setFullscreenElement: (element: Element | null) => void;
} {
  let fullscreenElement: Element | null = null;
  const setFullscreenElement = (element: Element | null): void => {
    fullscreenElement = element;
    document.dispatchEvent(new Event("fullscreenchange"));
  };
  const requestFullscreen = vi.fn(async () => setFullscreenElement(viewer));
  const exitFullscreen = vi.fn(async () => setFullscreenElement(null));

  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
  Object.defineProperty(viewer, "requestFullscreen", { configurable: true, value: requestFullscreen });

  return { exitFullscreen, requestFullscreen, setFullscreenElement };
}

beforeEach(() => {
  cleanup = (): void => {};
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("viewer full-screen control", () => {
  it("enters and exits full screen while keeping its accessible state synchronized", async () => {
    const { button, viewer } = elements();
    const fullscreen = installFullscreen(viewer);
    cleanup = initViewerFullscreen(viewer, button);

    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("View MNI152 viewer full screen");

    button.click();
    await vi.waitFor(() => expect(fullscreen.requestFullscreen).toHaveBeenCalledOnce());
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.title).toBe("Exit full screen");

    button.click();
    await vi.waitFor(() => expect(fullscreen.exitFullscreen).toHaveBeenCalledOnce());
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("follows a full-screen exit initiated by the browser", () => {
    const { button, viewer } = elements();
    const fullscreen = installFullscreen(viewer);
    cleanup = initViewerFullscreen(viewer, button);

    fullscreen.setFullscreenElement(viewer);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fullscreen.setFullscreenElement(null);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("hides the control when the Fullscreen API is unavailable", () => {
    const { button, viewer } = elements();
    cleanup = initViewerFullscreen(viewer, button);
    expect(button.hidden).toBe(true);
  });

  it("reports a rejected full-screen request without changing state", async () => {
    const { button, viewer } = elements();
    installFullscreen(viewer);
    const error = new Error("Full screen was denied.");
    Object.defineProperty(viewer, "requestFullscreen", {
      configurable: true,
      value: vi.fn(() => Promise.reject(error)),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    cleanup = initViewerFullscreen(viewer, button);

    button.click();
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith("Could not change the RAVE viewer full-screen mode:", error),
    );
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
