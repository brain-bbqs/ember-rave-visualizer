import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  DATA_MARKER,
  DECOMPRESSION_SHIM,
  DISTRIBUTED_SETTINGS,
  joinViewer,
  storedPath,
  type ViewerManifest,
} from "../../scripts/raveViewerData";

const ORIGINAL_SHA256 = "936f3ff65ae9af758437696932c26f8176f5afdbd88760a8b5da7c42bf6583e4";
const VIEWER_DIR = resolve(process.cwd(), "public/vendor/rave");
const DATA_DIR = resolve(VIEWER_DIR, "data");

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

const html = readFileSync(resolve(VIEWER_DIR, "RAVE_MNI_template.html"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(VIEWER_DIR, "manifest.json"), "utf8")) as ViewerManifest;

function readDataFile(stored: string): Uint8Array {
  const bytes = readFileSync(resolve(DATA_DIR, stored));
  return stored.endsWith(".gz") ? gunzipSync(bytes) : bytes;
}

describe("vendored RAVE viewer", () => {
  it("stores exactly the files its manifest lists, each where storedPath puts it", () => {
    const onDisk = readdirSync(DATA_DIR, { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(resolve(DATA_DIR, entry)).isFile())
      .map((entry) => entry.split(sep).join("/"));
    expect(onDisk.sort()).toEqual(manifest.files.map((file) => file.stored).sort());
    for (const file of manifest.files) expect(file.stored).toBe(storedPath(file.path));
  });

  it("keeps every data file byte-identical to the copy the supplied export embedded", () => {
    for (const file of manifest.files) {
      const bytes = readDataFile(file.stored);
      expect([file.path, bytes.length, sha256(bytes)]).toEqual([file.path, file.size, file.sha256]);
    }
  });

  it("differs from the supplied export only by its documented settings, shim and data folder", () => {
    expect(manifest.source.sha256).toBe(ORIGINAL_SHA256);
    expect(html).toContain(DATA_MARKER);
    expect(html).toContain(DECOMPRESSION_SHIM);
    for (const [name, value] of Object.entries(DISTRIBUTED_SETTINGS)) {
      expect(html).toContain(`"${name}":${JSON.stringify(value)}`);
    }

    const files = manifest.files.map(({ path, type, stored }) => ({ path, type, bytes: readDataFile(stored) }));
    expect(sha256(joinViewer(html, files, manifest.originalSettings))).toBe(ORIGINAL_SHA256);
  });
});
