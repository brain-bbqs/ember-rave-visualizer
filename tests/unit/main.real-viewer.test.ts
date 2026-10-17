// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { bootMain, el, pickFile } from "./helpers/mainHarness";

const viewer = vi.hoisted(() => ({
  whenReady: vi.fn(async () => {}),
  loadCsv: vi.fn(async () => {}),
  clearElectrodes: vi.fn(async () => {}),
  setBackground: vi.fn(async () => {}),
  destroy: vi.fn(),
}));

const createViewerBridge = vi.hoisted(() => vi.fn(() => viewer));

vi.mock("../../src/ui/viewer", () => ({ createViewerBridge }));

beforeAll(async () => {
  await bootMain();
});

describe("main.ts boot with the viewer adapter", () => {
  it("points the iframe at the vendored viewer and clears its loading cover when ready", async () => {
    const frame = el<HTMLIFrameElement>("viewer-frame");
    expect(createViewerBridge).toHaveBeenCalledWith(frame);
    expect(frame.src).toMatch(/\/vendor\/rave\/RAVE_MNI_template\.html$/);
    await vi.waitFor(() => expect(el("viewer-loading").hidden).toBe(true));
    expect(viewer.setBackground).toHaveBeenCalled();
  });

  it("hands a validated file to the viewer adapter", async () => {
    const csv = "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,1,2,3,A1";
    const file = new File([csv], "subject.csv", { type: "text/csv" });
    pickFile(file);
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("subject.csv loaded"));
    expect(viewer.loadCsv).toHaveBeenCalledWith(file);
  });

  it("shows an adapter load error and remains able to load another CSV", async () => {
    viewer.loadCsv.mockRejectedValueOnce(new Error("RAVE could not render the table."));
    const failed = new File(["Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n2,4,5,6,A2"], "failed.csv", {
      type: "text/csv",
    });
    pickFile(failed);
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("RAVE could not render"));

    const recovered = new File(["Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n3,7,8,9,A3"], "recovered.csv", {
      type: "text/csv",
    });
    pickFile(recovered);
    await vi.waitFor(() => expect(el("load-status").textContent).toContain("recovered.csv loaded"));
  });

  it("warns if the viewer cannot follow a theme change", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    viewer.setBackground.mockRejectedValueOnce(new Error("controller unavailable"));
    el("theme-toggle").click();
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith("Could not update the RAVE viewer theme:", expect.any(Error)),
    );
    warn.mockRestore();
  });

  it("returns the status to idle even if clearing the viewer fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    viewer.clearElectrodes.mockRejectedValueOnce(new Error("clear unavailable"));
    el("clear-electrodes-btn").click();
    expect(el("load-status").hidden).toBe(true);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith("Could not clear the RAVE viewer:", expect.any(Error)));
    warn.mockRestore();
  });
});
