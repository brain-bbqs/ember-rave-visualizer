// Splits a self-contained threeBrain viewer export (the single HTML file RAVE writes) into a light
// page plus the data files it embeds as base64, optionally leaving out whole surface types, and joins
// the page and the files it kept back into the export (minus any dropped files) byte for byte.

export interface ViewerDataFile {
  /** Path inside the data folder, exactly as the export names it. */
  path: string;
  /** MIME type the export recorded for the file. */
  type: string;
  bytes: Uint8Array;
}

export interface ViewerManifestFile {
  path: string;
  /** Where the file is stored inside the data folder (see {@link storedPath}). */
  stored: string;
  type: string;
  size: number;
  sha256: string;
}

export interface ViewerManifest {
  source: {
    sha256: string;
    /** Digest of the export with the dropped files' blocks removed, which {@link joinViewer} rebuilds. */
    trimmedSha256: string;
  };
  dataFolder: string;
  droppedSurfaceTypes: string[];
  originalSettings: Record<string, unknown>;
  /** The export's files that ship, in the order it embedded them, which {@link joinViewer} needs. */
  files: ViewerManifestFile[];
  /** Files the split writes itself: the config without the dropped surfaces. */
  derived: ViewerManifestFile[];
  /** The export's files left out with the dropped surfaces. */
  dropped: Omit<ViewerManifestFile, "stored">[];
}

export interface SplitViewerResult {
  html: string;
  files: ViewerDataFile[];
  derived: ViewerDataFile[];
  dropped: ViewerDataFile[];
  originalSettings: Record<string, unknown>;
  trimmedExport: string;
}

interface ConfigGroup {
  name: string;
  cache_name?: string | null;
  group_data?: Record<string, unknown> | null;
}

interface ViewerConfig {
  groups: ConfigGroup[];
  geoms: { group?: { group_name?: string } | null }[];
}

export const DATA_FOLDER = "data/";

// The template's inflated and spherical surfaces are nearly half of its data and this app does not
// use them, so the split leaves them out.
export const DROPPED_SURFACE_TYPES: readonly string[] = ["inflated", "sphere.reg"];

export const DERIVED_CONFIG_PREFIX = "ember-";

export const DATA_MARKER = `<!-- Template data: ${DATA_FOLDER} (see manifest.json) -->`;

export const DISTRIBUTED_SETTINGS: Readonly<Record<string, unknown>> = {
  cache_folder: DATA_FOLDER,
  // No worker matching this engine build ships with the viewer, so keep every load on the fetch
  // path the decompression shim covers instead of failing over from a missing worker per file.
  worker_script: null,
  custom_javascript:
    "window.raveViewerApp = app; app.controllerGUI.getController('Dragdrop Uploader').hide(); window.parent.postMessage({ type: 'ember-rave-viewer-ready' }, window.location.origin);",
};

// The engine requests the export's own file names; this shim maps each request under the data
// folder to its storedPath and inflates the gzip-compressed files natively before the engine sees them.
export const DECOMPRESSION_SHIM = `<script>
// Added by EMBER: template data beside this page is stored gzip-compressed (see manifest.json).
(() => {
  const dataRoot = new URL("${DATA_FOLDER}", document.baseURI);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
    if (url.origin !== dataRoot.origin || !url.pathname.startsWith(dataRoot.pathname)) return nativeFetch(input, init);
    const compressed = !url.pathname.endsWith(".mgz");
    const type = url.pathname.endsWith(".json") ? "application/json" : "application/octet-stream";
    const segments = url.pathname.slice(dataRoot.pathname.length).split("/");
    url.pathname = dataRoot.pathname + segments.map((segment) => segment.replace(/^_+/, "")).join("/");
    if (compressed) url.pathname += ".gz";
    const request = input instanceof Request ? new Request(url, input) : new Request(url, init);
    if (!compressed) return nativeFetch(request);
    return nativeFetch(request).then((response) => {
      const alreadyDecoded = /gzip/i.test(response.headers.get("Content-Encoding") ?? "");
      if (!response.ok || !response.body || alreadyDecoded) return response;
      return new Response(response.body.pipeThrough(new DecompressionStream("gzip")), {
        status: response.status,
        statusText: response.statusText,
        headers: { "Content-Type": type },
      });
    });
  };
})();
</script>
`;

const BLOCK_PATTERN =
  /<script type='text\/plain;charset=UTF-8' data-for='#([^']+)' data-partition='(\d+)' data-type='([^']+)' data-size='(\d+)' data-start='(\d+)' data-parition-size='(\d+)'>\n([A-Za-z0-9+/=\n]*)<\/script>/g;
const SAFE_PATH = /^[\w.-]+(?:\/[\w.-]+)*$/;
const PARTITION_BYTES = 48473;
const BASE64_LINE_LENGTH = 72;
const SHIM_ANCHOR = "<script>";

// GitHub Pages runs Jekyll over this site, and Jekyll leaves out any path segment that starts with
// "_" (the export's "__global_data" folder, for one), so stored names drop those underscores.
export function storedPath(path: string): string {
  const visible = path
    .split("/")
    .map((segment) => segment.replace(/^_+/, ""))
    .join("/");
  return visible.endsWith(".mgz") ? visible : `${visible}.gz`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function settingPattern(name: string): RegExp {
  return new RegExp(`"${name}":(null|true|false|-?\\d[\\d.eE+-]*|"(?:[^"\\\\]|\\\\.)*")`, "g");
}

function replaceSettings(html: string, settings: Readonly<Record<string, unknown>>): [string, Record<string, unknown>] {
  const previous: Record<string, unknown> = {};
  let result = html;
  for (const [name, value] of Object.entries(settings)) {
    const matches = [...result.matchAll(settingPattern(name))];
    if (matches.length !== 1) throw new Error(`Expected one "${name}" widget setting, found ${matches.length}.`);
    previous[name] = JSON.parse(matches[0][1]);
    result = result.replace(settingPattern(name), () => `"${name}":${JSON.stringify(value)}`);
  }
  return [result, previous];
}

function decodeBlocks(blocks: RegExpExecArray[]): ViewerDataFile[] {
  const files = new Map<string, { type: string; size: number; parts: Uint8Array[]; offset: number }>();
  for (const [, path, partition, type, size, start, partitionSize, body] of blocks) {
    if (!SAFE_PATH.test(path) || path.split("/").includes("..")) throw new Error(`Unsafe data path: ${path}`);
    const file = files.get(path) ?? { type, size: Number(size), parts: [], offset: 0 };
    files.set(path, file);
    const bytes = fromBase64(body);
    if (
      Number(partition) !== file.parts.length ||
      Number(start) !== file.offset ||
      Number(partitionSize) !== bytes.length
    ) {
      throw new Error(`Partition ${partition} of ${path} is out of order or the wrong size.`);
    }
    file.parts.push(bytes);
    file.offset += bytes.length;
  }
  return [...files].map(([path, { type, size, parts, offset }]) => {
    if (offset !== size) throw new Error(`${path} decoded to ${offset} bytes instead of ${size}.`);
    const bytes = new Uint8Array(size);
    let position = 0;
    for (const part of parts) {
      bytes.set(part, position);
      position += part.length;
    }
    return { path, type, bytes };
  });
}

function embedFile({ path, type, bytes }: ViewerDataFile): string {
  const blocks: string[] = [];
  for (let start = 0, partition = 0; start < bytes.length; start += PARTITION_BYTES, partition += 1) {
    const part = bytes.subarray(start, start + PARTITION_BYTES);
    // R's encoder breaks the line after every full line of whole 3-byte groups, so a chunk whose
    // base64 fills its last line exactly gets a trailing newline unless that line ends in padding.
    let wrapped = toBase64(part).replace(new RegExp(`.{${BASE64_LINE_LENGTH}}`, "g"), (line) => `${line}\n`);
    if (part.length % 3 !== 0 && wrapped.endsWith("\n")) wrapped = wrapped.slice(0, -1);
    blocks.push(
      `<script type='text/plain;charset=UTF-8' data-for='#${path}' data-partition='${partition}' data-type='${type}' data-size='${bytes.length}' data-start='${start}' data-parition-size='${part.length}'>\n${wrapped}\n</script>`,
    );
  }
  return blocks.join("\n");
}

function groupFiles(group: ConfigGroup): string[] {
  return Object.values(group.group_data ?? {}).flatMap((entry) =>
    typeof entry === "object" && entry !== null && "file_name" in entry && typeof entry.file_name === "string"
      ? [`${group.cache_name ?? ""}/${entry.file_name}`]
      : [],
  );
}

function isSurfaceOf(group: ConfigGroup, types: readonly string[]): boolean {
  const type = group.group_data?.surface_type;
  return typeof type === "string" && types.includes(type);
}

/** Removes surface types from a viewer config, returning it and the data files only they used. */
export function dropSurfaces(configText: string, types: readonly string[]): { config: string; droppedPaths: string[] } {
  const config = JSON.parse(configText) as ViewerConfig;
  const missing = types.filter((type) => !config.groups.some((group) => isSurfaceOf(group, [type])));
  if (missing.length > 0) throw new Error(`The viewer config has no ${missing.join(", ")} surface to drop.`);

  const dropped = config.groups.filter((group) => isSurfaceOf(group, types));
  const kept = config.groups.filter((group) => !isSurfaceOf(group, types));
  const keptFiles = new Set(kept.flatMap(groupFiles));
  const droppedGroups = new Set(dropped.map((group) => group.name));
  const droppedPaths = [...new Set(dropped.flatMap(groupFiles))].filter((path) => !keptFiles.has(path));
  const geoms = config.geoms.filter((geom) => !droppedGroups.has(geom.group?.group_name ?? ""));
  return { config: JSON.stringify({ ...config, groups: kept, geoms }), droppedPaths };
}

// Rather than edit the export's config, the split writes a trimmed copy beside it and points the
// widget at that, so every file the export embedded stays byte-identical.
function deriveConfig(
  exportHtml: string,
  files: readonly ViewerDataFile[],
  types: readonly string[],
): { derived: ViewerDataFile[]; droppedPaths: string[]; settings: Readonly<Record<string, unknown>> } {
  if (types.length === 0) return { derived: [], droppedPaths: [], settings: DISTRIBUTED_SETTINGS };
  const matches = [...exportHtml.matchAll(settingPattern("data_filename"))];
  if (matches.length !== 1) throw new Error(`Expected one "data_filename" widget setting, found ${matches.length}.`);
  const configPath = JSON.parse(matches[0][1]) as string;
  const config = files.find((file) => file.path === configPath);
  if (!config) throw new Error(`The export does not embed its config, ${configPath}.`);

  const { config: text, droppedPaths } = dropSurfaces(new TextDecoder().decode(config.bytes), types);
  const absent = droppedPaths.filter((path) => !files.some((file) => file.path === path));
  if (absent.length > 0) throw new Error(`The export does not embed ${absent.join(", ")}.`);
  const derivedPath = configPath.replace(/[^/]+$/, (name) => `${DERIVED_CONFIG_PREFIX}${name}`);
  return {
    derived: [{ path: derivedPath, type: config.type, bytes: new TextEncoder().encode(text) }],
    droppedPaths,
    settings: { ...DISTRIBUTED_SETTINGS, data_filename: derivedPath },
  };
}

function contiguousBlocks(exportHtml: string): RegExpExecArray[] {
  const blocks = [...exportHtml.matchAll(BLOCK_PATTERN)];
  if (blocks.length === 0) throw new Error("The viewer export embeds no data files.");
  blocks.slice(1).forEach((block, index) => {
    const previous = blocks[index];
    if (exportHtml.slice(previous.index + previous[0].length, block.index) !== "\n") {
      throw new Error("The embedded data files are not one contiguous run of blocks.");
    }
  });
  return blocks;
}

export function splitViewer(exportHtml: string, dropSurfaceTypes: readonly string[] = []): SplitViewerResult {
  if (exportHtml.includes(DATA_MARKER)) throw new Error("This viewer has already been split.");
  const blocks = contiguousBlocks(exportHtml);
  const all = decodeBlocks(blocks);
  const { derived, droppedPaths, settings } = deriveConfig(exportHtml, all, dropSurfaceTypes);
  const files = all.filter((file) => !droppedPaths.includes(file.path));
  const stored = [...files, ...derived].map((file) => storedPath(file.path));
  if (new Set(stored).size !== stored.length || stored.some((path) => /(?:^|\/)(?:\.gz)?(?:\/|$)/.test(path))) {
    throw new Error("Two data files share a stored path, or a path segment is only underscores.");
  }

  const before = exportHtml.slice(0, blocks[0].index);
  const after = exportHtml.slice(blocks[blocks.length - 1].index + blocks[blocks.length - 1][0].length);
  const [withSettings, originalSettings] = replaceSettings(before + DATA_MARKER + after, settings);
  const anchor = withSettings.indexOf(SHIM_ANCHOR);
  if (anchor < 0) throw new Error("The viewer export has no script for the decompression shim to precede.");
  const keptBlocks = blocks.filter((block) => !droppedPaths.includes(block[1]));
  return {
    html: withSettings.slice(0, anchor) + DECOMPRESSION_SHIM + withSettings.slice(anchor),
    files,
    derived,
    dropped: all.filter((file) => droppedPaths.includes(file.path)),
    originalSettings,
    trimmedExport: before + keptBlocks.map((block) => block[0]).join("\n") + after,
  };
}

export function joinViewer(
  html: string,
  files: readonly ViewerDataFile[],
  originalSettings: Readonly<Record<string, unknown>>,
): string {
  if (!html.includes(DATA_MARKER) || !html.includes(DECOMPRESSION_SHIM)) {
    throw new Error("This viewer was not produced by splitViewer.");
  }
  const [withSettings] = replaceSettings(html.replace(DECOMPRESSION_SHIM, ""), originalSettings);
  return withSettings.replace(DATA_MARKER, () => files.map(embedFile).join("\n"));
}
