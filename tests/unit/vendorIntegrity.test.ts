import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ORIGINAL_SHA256 = "936f3ff65ae9af758437696932c26f8176f5afdbd88760a8b5da7c42bf6583e4";
const DISTRIBUTED_SHA256 = "a2778046801ea8392a6a11dd28bf40b0c15627c52b05dfd14a3e69028bf4a54b";
const ORIGINAL_SETTING = '"custom_javascript":null';
const ADAPTER_SETTING = `"custom_javascript":"window.raveViewerApp = app; app.controllerGUI.getController('Dragdrop Uploader').hide(); window.parent.postMessage({ type: 'ember-rave-viewer-ready' }, window.location.origin);"`;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("vendored RAVE viewer", () => {
  it("differs from the supplied file only by its documented adapter setting", () => {
    const html = readFileSync(resolve(process.cwd(), "public/vendor/rave/RAVE_MNI_template.html"), "utf8");
    expect(sha256(html)).toBe(DISTRIBUTED_SHA256);
    expect(html).toContain(ADAPTER_SETTING);
    expect(sha256(html.replace(ADAPTER_SETTING, ORIGINAL_SETTING))).toBe(ORIGINAL_SHA256);
  });
});
