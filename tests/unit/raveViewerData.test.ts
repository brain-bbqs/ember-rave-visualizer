import { describe, expect, it } from "vitest";
import {
  DATA_MARKER,
  DECOMPRESSION_SHIM,
  DISTRIBUTED_SETTINGS,
  dropSurfaces,
  joinViewer,
  splitViewer,
  storedPath,
  type ViewerDataFile,
} from "../../scripts/raveViewerData";

const ORIGINAL_SETTINGS = { cache_folder: "#", worker_script: "lib/worker.js", custom_javascript: null };

function widget(settings: Readonly<Record<string, unknown>>): string {
  const pairs = Object.entries(settings).map(([name, value]) => `"${name}":${JSON.stringify(value)}`);
  return `<script type="application/json" data-for="w">{"x":{"settings":{"title":"",${pairs.join(",")}}}}</script>`;
}

const SPLIT_HTML = [
  "<!DOCTYPE html>\n<head>\n<style>body{}</style>\n",
  DECOMPRESSION_SHIM,
  "<script>engine();</script>\n<title>T</title>\n",
  DATA_MARKER,
  "\n</head>\n<body>\n",
  widget(DISTRIBUTED_SETTINGS),
  "\n</body>\n",
].join("");

function bytes(length: number, seed = 1): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (index * 31 + seed) % 256);
}

const FILES: ViewerDataFile[] = [
  { path: "__global_data/lut.json", type: "application/json", bytes: new TextEncoder().encode('{"a":1}') },
  { path: "subject/surf/lh.pial", type: "application/octet-stream", bytes: bytes(48473 * 2 + 5) },
  { path: "subject/mri/brain.mgz", type: "application/octet-stream", bytes: bytes(54, 7) },
];

const EXPORT_HTML = joinViewer(SPLIT_HTML, FILES, ORIGINAL_SETTINGS);

describe("joinViewer", () => {
  it("embeds each file the way RAVE writes it, as 48,473-byte base64 partitions", () => {
    expect(EXPORT_HTML).toContain(
      "<script type='text/plain;charset=UTF-8' data-for='#__global_data/lut.json' data-partition='0' data-type='application/json' data-size='7' data-start='0' data-parition-size='7'>\neyJhIjoxfQ==\n</script>\n",
    );
    expect(EXPORT_HTML.match(/data-for='#subject\/surf\/lh\.pial' data-partition='\d'[^>]*/g)).toEqual([
      "data-for='#subject/surf/lh.pial' data-partition='0' data-type='application/octet-stream' data-size='96951' data-start='0' data-parition-size='48473'",
      "data-for='#subject/surf/lh.pial' data-partition='1' data-type='application/octet-stream' data-size='96951' data-start='48473' data-parition-size='48473'",
      "data-for='#subject/surf/lh.pial' data-partition='2' data-type='application/octet-stream' data-size='96951' data-start='96946' data-parition-size='5'",
    ]);
    expect(EXPORT_HTML).toContain(widget(ORIGINAL_SETTINGS));
    expect(EXPORT_HTML).not.toContain(DECOMPRESSION_SHIM);
  });

  it.each([
    ["ends a full line of whole groups with an extra newline", 54, /^[A-Za-z0-9+/]{72}\n$/],
    ["does not break after a full line ending in padding", 53, /^[A-Za-z0-9+/]{71}=$/],
    ["leaves a short final line unbroken", 10, /^[A-Za-z0-9+/]{14}==$/],
  ])("%s", (_, length, body) => {
    const file = { path: "f.bin", type: "application/octet-stream", bytes: bytes(length) };
    const block = /data-parition-size='\d+'>\n([\s\S]*)\n<\/script>/.exec(
      joinViewer(SPLIT_HTML, [file], ORIGINAL_SETTINGS),
    );
    expect(block?.[1]).toMatch(body);
  });

  it("refuses a page splitViewer did not produce", () => {
    expect(() => joinViewer("<html></html>", FILES, ORIGINAL_SETTINGS)).toThrow("not produced by splitViewer");
  });
});

describe("splitViewer", () => {
  it("undoes joinViewer exactly", () => {
    const split = splitViewer(EXPORT_HTML);
    expect(split.html).toBe(SPLIT_HTML);
    expect(split.originalSettings).toEqual(ORIGINAL_SETTINGS);
    expect(split.files).toEqual(FILES);
    expect(joinViewer(split.html, split.files, split.originalSettings)).toBe(EXPORT_HTML);
  });

  it.each([
    ["an already split page", SPLIT_HTML, "already been split"],
    [
      "a page with no embedded data",
      EXPORT_HTML.replace(/<script type='text\/plain[\s\S]*?<\/script>\n?/g, ""),
      "embeds no data",
    ],
    [
      "data blocks split by other markup",
      EXPORT_HTML.replace("</script>\n<script type='text/plain", "</script>\n<p></p>\n<script type='text/plain"),
      "contiguous",
    ],
    [
      "a path that climbs out of the data folder",
      EXPORT_HTML.replaceAll("#subject/mri/brain.mgz", "#../brain.mgz"),
      "Unsafe data path",
    ],
    ["a partition out of order", EXPORT_HTML.replace("data-partition='1'", "data-partition='2'"), "out of order"],
    ["a file shorter than its recorded size", EXPORT_HTML.replaceAll("data-size='7'", "data-size='8'"), "instead of 8"],
    [
      "a missing widget setting",
      EXPORT_HTML.replace('"cache_folder":"#",', ""),
      'one "cache_folder" widget setting, found 0',
    ],
    ["a page with no script to anchor the shim", EXPORT_HTML.replace("<script>engine();</script>", ""), "no script"],
    [
      "two files that would share a stored path",
      EXPORT_HTML.replaceAll("#subject/mri/brain.mgz", "#_subject/surf/lh.pial"),
      "share a stored path",
    ],
    [
      "a path segment of only underscores",
      EXPORT_HTML.replaceAll("#subject/mri/brain.mgz", "#subject/__/brain.mgz"),
      "only underscores",
    ],
  ])("rejects %s", (_, html, message) => {
    expect(() => splitViewer(html)).toThrow(message);
  });
});

describe("storedPath", () => {
  it.each([
    ["subject/mri/brain.mgz", "subject/mri/brain.mgz"],
    ["subject/surf/lh.pial", "subject/surf/lh.pial.gz"],
    ["config.json", "config.json"],
    ["__global_data/lut.json", "global_data/lut.json"],
    ["_subject/mri/_brain.mgz", "subject/mri/brain.mgz"],
  ])("stores %s as %s", (path, stored) => {
    expect(storedPath(path)).toBe(stored);
  });
});

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const CONFIG = JSON.stringify({
  groups: [
    { name: "__global_data", cache_name: "__global_data", group_data: { lut: { file_name: "lut.json" } } },
    {
      name: "Surface - pial",
      cache_name: "subject/surf",
      group_data: { surface_type: "pial", vertices: { file_name: "lh.pial" }, color: { file_name: "lh.sulc" } },
    },
    {
      name: "Surface - inflated",
      cache_name: "subject/surf",
      group_data: { surface_type: "inflated", vertices: { file_name: "lh.inflated" }, color: { file_name: "lh.sulc" } },
    },
  ],
  geoms: [
    { name: "pial", group: { group_name: "Surface - pial" } },
    { name: "inflated", group: { group_name: "Surface - inflated" } },
    { name: "blank", group: null },
  ],
});

describe("dropSurfaces", () => {
  it("removes a surface type's group and geometries, and reports the files only it used", () => {
    const { config, droppedPaths } = dropSurfaces(CONFIG, ["inflated"]);
    const parsed = JSON.parse(config) as { groups: { name: string }[]; geoms: { name: string }[] };
    expect(parsed.groups.map((group) => group.name)).toEqual(["__global_data", "Surface - pial"]);
    expect(parsed.geoms.map((geom) => geom.name)).toEqual(["pial", "blank"]);
    expect(droppedPaths).toEqual(["subject/surf/lh.inflated"]);
  });

  it.each([
    ["keeps", `${CONFIG}\n`, true],
    ["adds no", CONFIG.trimEnd(), false],
  ])("%s trailing newline as the original config does", (_, original, newline) => {
    expect(dropSurfaces(original, ["inflated"]).config.endsWith("}\n")).toBe(newline);
  });

  it("refuses a surface type the config does not have", () => {
    expect(() => dropSurfaces(CONFIG, ["inflated", "sphere.reg"])).toThrow("no sphere.reg surface to drop");
  });
});

describe("splitViewer with dropped surfaces", () => {
  const PAGE = SPLIT_HTML.replace('{"x":{', '{"x":{"data_filename":"ember-config.json",');
  const SETTINGS = { ...ORIGINAL_SETTINGS, data_filename: "config.json" };
  const ALL_FILES: ViewerDataFile[] = [
    { path: "config.json", type: "application/json", bytes: encode(CONFIG) },
    { path: "__global_data/lut.json", type: "application/json", bytes: encode("{}") },
    { path: "subject/surf/lh.pial", type: "application/octet-stream", bytes: bytes(30) },
    { path: "subject/surf/lh.inflated", type: "application/octet-stream", bytes: bytes(40, 3) },
    { path: "subject/surf/lh.sulc", type: "application/octet-stream", bytes: bytes(20, 5) },
  ];
  const KEPT_FILES = ALL_FILES.filter((file) => file.path !== "subject/surf/lh.inflated");
  const split = splitViewer(joinViewer(PAGE, ALL_FILES, SETTINGS), ["inflated"]);

  it("ships every other file unchanged and points the widget at a trimmed copy of the config", () => {
    expect(split.files).toEqual(KEPT_FILES);
    expect(split.dropped.map((file) => file.path)).toEqual(["subject/surf/lh.inflated"]);
    expect(split.derived).toEqual([
      { path: "ember-config.json", type: "application/json", bytes: encode(dropSurfaces(CONFIG, ["inflated"]).config) },
    ]);
    expect(split.originalSettings).toEqual(SETTINGS);
    expect(split.html).toBe(PAGE);
  });

  it("joins back into the export without the dropped file's blocks", () => {
    expect(split.trimmedExport).toBe(joinViewer(PAGE, KEPT_FILES, SETTINGS));
    expect(joinViewer(split.html, split.files, split.originalSettings)).toBe(split.trimmedExport);
  });

  it.each([
    ["an export missing its config", ALL_FILES.slice(1), "does not embed its config, config.json"],
    [
      "an export missing a file the config names",
      ALL_FILES.filter((file) => file.path !== "subject/surf/lh.inflated"),
      "does not embed subject/surf/lh.inflated",
    ],
  ])("rejects %s", (_, files, message) => {
    expect(() => splitViewer(joinViewer(PAGE, files, SETTINGS), ["inflated"])).toThrow(message);
  });
});
