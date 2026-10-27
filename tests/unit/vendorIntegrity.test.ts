import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  DATA_MARKER,
  DECOMPRESSION_SHIM,
  DISTRIBUTED_SETTINGS,
  DROPPED_SURFACE_TYPES,
  dropSurfaces,
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
  it("stores exactly the shipped and derived files its manifest lists, each where storedPath puts it", () => {
    const onDisk = readdirSync(DATA_DIR, { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(resolve(DATA_DIR, entry)).isFile())
      .map((entry) => entry.split(sep).join("/"));
    const listed = [...manifest.files, ...manifest.derived];
    expect(onDisk.sort()).toEqual(listed.map((file) => file.stored).sort());
    for (const file of listed) expect(file.stored).toBe(storedPath(file.path));
  });

  it("matches every stored file to the digest its manifest records", () => {
    for (const file of [...manifest.files, ...manifest.derived]) {
      const bytes = readDataFile(file.stored);
      expect([file.path, bytes.length, sha256(bytes)]).toEqual([file.path, file.size, file.sha256]);
    }
  });

  it("drops only the configured surface types, through a trimmed copy of the export's config", () => {
    expect(manifest.droppedSurfaceTypes).toEqual(DROPPED_SURFACE_TYPES);
    const configPath = manifest.originalSettings.data_filename as string;
    const original = new TextDecoder().decode(readDataFile(storedPath(configPath)));
    const { config, droppedPaths } = dropSurfaces(original, DROPPED_SURFACE_TYPES);

    expect(manifest.derived.map((file) => file.path)).toEqual([`ember-${configPath}`]);
    expect(new TextDecoder().decode(readDataFile(manifest.derived[0].stored))).toBe(config);
    expect(manifest.dropped.map((file) => file.path).sort()).toEqual([...droppedPaths].sort());
    expect(html).toContain(`"data_filename":"ember-${configPath}"`);
  });

  it("rebuilds the supplied export, minus the dropped files, from the page and the files it ships", () => {
    expect(manifest.source.sha256).toBe(ORIGINAL_SHA256);
    expect(html).toContain(DATA_MARKER);
    expect(html).toContain(DECOMPRESSION_SHIM);
    for (const [name, value] of Object.entries(DISTRIBUTED_SETTINGS)) {
      expect(html).toContain(`"${name}":${JSON.stringify(value)}`);
    }

    const files = manifest.files.map(({ path, type, stored }) => ({ path, type, bytes: readDataFile(stored) }));
    expect(sha256(joinViewer(html, files, manifest.originalSettings))).toBe(manifest.source.trimmedSha256);
  });
});
