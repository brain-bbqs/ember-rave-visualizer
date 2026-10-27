/// <reference types="node" />
// Splits a self-contained RAVE viewer export into public/vendor/rave: the page, its data files
// (gzip-compressed apart from .mgz) and a manifest that lets tests rebuild the export exactly.
// Usage: node scripts/split-rave-viewer.ts <viewer-export.html> [output-dir]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { DATA_FOLDER, splitViewer, storedPath, type ViewerManifest } from "./raveViewerData.ts";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const [input, output = "public/vendor/rave"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/split-rave-viewer.ts <viewer-export.html> [output-dir]");
  process.exit(1);
}

const exportBytes = readFileSync(input);
const { html, files, originalSettings } = splitViewer(exportBytes.toString("utf8"));
const dataDir = resolve(output, DATA_FOLDER);
rmSync(dataDir, { recursive: true, force: true });

for (const file of files) {
  const target = join(dataDir, storedPath(file.path));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, target.endsWith(".gz") ? gzipSync(file.bytes, { level: 9 }) : file.bytes);
}
writeFileSync(resolve(output, "RAVE_MNI_template.html"), html);

const manifest: ViewerManifest = {
  source: { sha256: sha256(exportBytes) },
  dataFolder: DATA_FOLDER,
  originalSettings,
  files: files.map(({ path, type, bytes }) => ({
    path,
    stored: storedPath(path),
    type,
    size: bytes.length,
    sha256: sha256(bytes),
  })),
};
writeFileSync(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Wrote ${files.length} data files and a ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB page to ${output}.`,
);
