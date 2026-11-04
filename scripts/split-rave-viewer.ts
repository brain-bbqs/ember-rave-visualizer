/// <reference types="node" />
// Splits a self-contained RAVE viewer export into public/vendor/rave: the page, its data files
// (gzip-compressed apart from .mgz and .json, without the template parts in DROPPED_PARTS) and a
// manifest that lets tests check every shipped file against the export.
// Usage: node scripts/split-rave-viewer.ts <viewer-export.html> [output-dir]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  DATA_FOLDER,
  DROPPED_PARTS,
  splitViewer,
  storedPath,
  type ViewerDataFile,
  type ViewerManifest,
} from "./raveViewerData.ts";

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function describe({ path, type, bytes }: ViewerDataFile): ViewerManifest["dropped"][number] {
  return { path, type, size: bytes.length, sha256: sha256(bytes) };
}

const [input, output = "public/vendor/rave"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/split-rave-viewer.ts <viewer-export.html> [output-dir]");
  process.exit(1);
}

const exportBytes = readFileSync(input);
const split = splitViewer(exportBytes.toString("utf8"), DROPPED_PARTS);
const dataDir = resolve(output, DATA_FOLDER);
rmSync(dataDir, { recursive: true, force: true });

for (const file of [...split.files, ...split.derived]) {
  const target = join(dataDir, storedPath(file.path));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, target.endsWith(".gz") ? gzipSync(file.bytes, { level: 9 }) : file.bytes);
}
writeFileSync(resolve(output, "RAVE_MNI_template.html"), split.html);

const manifest: ViewerManifest = {
  source: { sha256: sha256(exportBytes), trimmedSha256: sha256(split.trimmedExport) },
  dataFolder: DATA_FOLDER,
  droppedParts: DROPPED_PARTS,
  originalSettings: split.originalSettings,
  files: split.files.map((file) => ({ ...describe(file), stored: storedPath(file.path) })),
  derived: split.derived.map((file) => ({ ...describe(file), stored: storedPath(file.path) })),
  dropped: split.dropped.map(describe),
};
writeFileSync(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Wrote ${split.files.length + split.derived.length} data files (dropped ${split.dropped.length}) and a ` +
    `${(Buffer.byteLength(split.html) / 1e6).toFixed(1)} MB page to ${output}.`,
);
