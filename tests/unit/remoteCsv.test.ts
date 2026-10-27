// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { MAX_CSV_BYTES } from "../../src/lib/electrodeCsv";
import { fetchRemoteCsv, normalizeRemoteCsvUrl, RemoteCsvError } from "../../src/lib/remoteCsv";

const CSV = "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,1,2,3,A1";

function response(options: { ok?: boolean; status?: number; text?: string; length?: string | null } = {}): Response {
  const { ok = true, status = 200, text = CSV, length = null } = options;
  return {
    ok,
    status,
    headers: new Headers(length === null ? {} : { "content-length": length }),
    text: async () => text,
  } as Response;
}

describe("normalizeRemoteCsvUrl", () => {
  it("converts GitHub blob links to the raw content CDN", () => {
    expect(
      normalizeRemoteCsvUrl(
        " https://github.com/rave-ieeg/rave-ieeg.github.io/blob/abc123/posts/3dviewer/PAV080.csv?plain=1#L1 ",
      ),
    ).toEqual({
      requestedUrl: "https://github.com/rave-ieeg/rave-ieeg.github.io/blob/abc123/posts/3dviewer/PAV080.csv?plain=1#L1",
      downloadUrl: "https://raw.githubusercontent.com/rave-ieeg/rave-ieeg.github.io/abc123/posts/3dviewer/PAV080.csv",
      fileName: "PAV080.csv",
    });
  });

  it("also accepts GitHub /raw/ file links and safely encodes path segments", () => {
    expect(normalizeRemoteCsvUrl("https://www.github.com/org/repo/raw/main/a%20folder/test.csv").downloadUrl).toBe(
      "https://raw.githubusercontent.com/org/repo/main/a%20folder/test.csv",
    );
  });

  it("preserves ordinary public URLs", () => {
    expect(normalizeRemoteCsvUrl("http://example.org/files/subject.csv?download=1")).toEqual({
      requestedUrl: "http://example.org/files/subject.csv?download=1",
      downloadUrl: "http://example.org/files/subject.csv?download=1",
      fileName: "subject.csv",
    });
  });

  it.each([
    ["", "Enter a public CSV URL"],
    ["not a URL", "complete HTTP or HTTPS"],
    ["ftp://example.org/test.csv", "Only HTTP and HTTPS"],
    ["https://user:secret@example.org/test.csv", "username or password"],
    ["https://github.com/org/repo", "using a /blob/ or /raw/ link"],
    ["https://github.com/org/repo/tree/main/files", "using a /blob/ or /raw/ link"],
    ["https://example.org/test.tsv", "must point to a .csv file"],
    ["https://example.org/bad%E0.csv", "invalid percent encoding"],
  ])("rejects %s", (input, message) => {
    expect(() => normalizeRemoteCsvUrl(input)).toThrow(message);
  });

  it("uses a dedicated error type", () => {
    expect(() => normalizeRemoteCsvUrl("")).toThrow(RemoteCsvError);
  });
});

describe("fetchRemoteCsv", () => {
  it("downloads a CSV into a named File and forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () => response());
    const result = await fetchRemoteCsv("https://example.org/subject.csv", controller.signal, fetcher);

    expect(fetcher).toHaveBeenCalledWith("https://example.org/subject.csv", { signal: controller.signal });
    expect(result.file.name).toBe("subject.csv");
    expect(result.file.type).toBe("text/csv");
    expect(result.downloadUrl).toBe("https://example.org/subject.csv");
  });

  it("reports network and HTTP failures", async () => {
    await expect(
      fetchRemoteCsv(
        "https://example.org/subject.csv",
        undefined,
        vi.fn(async () => Promise.reject(new Error("no"))),
      ),
    ).rejects.toThrow("remote server may not allow browser access");
    await expect(
      fetchRemoteCsv(
        "https://example.org/subject.csv",
        undefined,
        vi.fn(async () => response({ ok: false, status: 404 })),
      ),
    ).rejects.toThrow("HTTP 404");
  });

  it("preserves AbortError so callers can silently cancel superseded requests", async () => {
    const aborted = new DOMException("aborted", "AbortError");
    await expect(
      fetchRemoteCsv(
        "https://example.org/subject.csv",
        undefined,
        vi.fn(async () => Promise.reject(aborted)),
      ),
    ).rejects.toBe(aborted);
  });

  it("rejects an oversized declared response without reading it", async () => {
    const text = vi.fn(async () => CSV);
    const oversized = response({ length: String(MAX_CSV_BYTES + 1) });
    oversized.text = text;
    await expect(
      fetchRemoteCsv(
        "https://example.org/subject.csv",
        undefined,
        vi.fn(async () => oversized),
      ),
    ).rejects.toThrow("larger than the 20 MB limit");
    expect(text).not.toHaveBeenCalled();
  });

  it("rejects an oversized response when content-length is absent", async () => {
    const oversized = "x".repeat(MAX_CSV_BYTES + 1);
    await expect(
      fetchRemoteCsv(
        "https://example.org/subject.csv",
        undefined,
        vi.fn(async () => response({ text: oversized })),
      ),
    ).rejects.toThrow("larger than the 20 MB limit");
  });
});
