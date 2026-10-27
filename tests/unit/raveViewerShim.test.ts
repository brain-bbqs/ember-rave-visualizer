import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { DECOMPRESSION_SHIM } from "../../scripts/raveViewerData";

const PAGE = "https://example.org/app/vendor/rave/RAVE_MNI_template.html";
const CONTENT = new TextEncoder().encode('{"surface":[1,2,3]}');

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function installShim(nativeFetch: Fetch): Fetch {
  const page = { fetch: nativeFetch };
  const source = DECOMPRESSION_SHIM.replace(/^<script>\n/, "").replace(/<\/script>\n$/, "");
  // The shim is a classic inline script; run it against stand-ins for the frame's globals.
  new Function("window", "document", source)(page, { baseURI: PAGE });
  return page.fetch;
}

function requestedUrl(nativeFetch: ReturnType<typeof vi.fn>): string {
  const [input] = nativeFetch.mock.calls[0] as [RequestInfo | URL];
  return input instanceof Request ? input.url : String(input);
}

const DATA = "https://example.org/app/vendor/rave/data/";

describe("viewer decompression shim", () => {
  it.each([
    ["a path relative to the page", "data/subject/surf/lh.pial", "subject/surf/lh.pial.gz", "application/octet-stream"],
    ["an origin-relative path", "/app/vendor/rave/data/config_1.json", "config_1.json.gz", "application/json"],
    ["a Request", new Request(`${DATA}__global_data/lut.json`), "global_data/lut.json.gz", "application/json"],
  ])("inflates a compressed data file requested by %s", async (_, input, stored, type) => {
    const nativeFetch = vi.fn(async () => new Response(gzipSync(CONTENT)));
    const response = await installShim(nativeFetch)(input);
    expect(requestedUrl(nativeFetch)).toBe(`${DATA}${stored}`);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(CONTENT);
    expect(response.headers.get("Content-Type")).toBe(type);
  });

  it("fetches an .mgz volume from its stored path without inflating it", async () => {
    const served = new Response("volume");
    const nativeFetch = vi.fn(async () => served);
    await expect(installShim(nativeFetch)("data/__subject/mri/brain.mgz")).resolves.toBe(served);
    expect(requestedUrl(nativeFetch)).toBe(`${DATA}subject/mri/brain.mgz`);
  });

  it("keeps a Request's headers when it asks for the compressed copy", async () => {
    const nativeFetch = vi.fn(async () => new Response(gzipSync(CONTENT)));
    const input = new Request("https://example.org/app/vendor/rave/data/a.json", { headers: { "X-Trace": "1" } });
    await installShim(nativeFetch)(input);
    const [forwarded] = nativeFetch.mock.calls[0] as unknown as [Request];
    expect(forwarded.headers.get("X-Trace")).toBe("1");
  });

  it.each([
    ["a file outside the data folder", "/app/index.html"],
    ["another origin", "https://cdn.example.com/app/vendor/rave/data/a.json"],
  ])("passes %s straight through", async (_, input) => {
    const passthrough = new Response("plain");
    const nativeFetch = vi.fn(async () => passthrough);
    await expect(installShim(nativeFetch)(input)).resolves.toBe(passthrough);
    expect(nativeFetch).toHaveBeenCalledWith(input, undefined);
  });

  it.each([
    ["a failed response", new Response("missing", { status: 404 })],
    ["a response the browser already decoded", new Response(CONTENT, { headers: { "Content-Encoding": "gzip" } })],
  ])("returns %s unchanged", async (_, served) => {
    const nativeFetch = vi.fn(async () => served);
    await expect(installShim(nativeFetch)("data/a.json")).resolves.toBe(served);
  });
});
