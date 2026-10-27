import { isTableFileName, MAX_TABLE_BYTES } from "./electrodeTable";

export interface RemoteTableUrl {
  requestedUrl: string;
  downloadUrl: string;
  fileName: string;
}

export interface RemoteTableFile extends RemoteTableUrl {
  file: File;
}

export class RemoteTableError extends Error {
  override name = "RemoteTableError";
}

function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new RemoteTableError("The URL contains invalid percent encoding.");
  }
}

function encodedPath(segments: string[]): string {
  return `/${segments.map((segment) => encodeURIComponent(decoded(segment))).join("/")}`;
}

export function normalizeRemoteTableUrl(input: string): RemoteTableUrl {
  const requestedUrl = input.trim();
  if (!requestedUrl) throw new RemoteTableError("Enter a public table URL.");

  let parsed: URL;
  try {
    parsed = new URL(requestedUrl);
  } catch {
    throw new RemoteTableError("Enter a complete HTTP or HTTPS URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new RemoteTableError("Only HTTP and HTTPS URLs can be loaded.");
  }
  if (parsed.username || parsed.password)
    throw new RemoteTableError("URLs containing a username or password are not supported.");

  let download = new URL(parsed);
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "github.com") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 5 || (segments[2] !== "blob" && segments[2] !== "raw")) {
      throw new RemoteTableError("The GitHub URL must point to a table file using a /blob/ or /raw/ link.");
    }
    download = new URL("https://raw.githubusercontent.com");
    download.pathname = encodedPath([segments[0], segments[1], segments[3], ...segments.slice(4)]);
    download.search = "";
    download.hash = "";
  }

  const lastSegment = download.pathname.split("/").filter(Boolean).at(-1) ?? "";
  const fileName = decoded(lastSegment);
  if (!isTableFileName(fileName)) throw new RemoteTableError("The URL must point to a .tsv or .csv file.");

  return { requestedUrl, downloadUrl: download.toString(), fileName };
}

export async function fetchRemoteTable(
  input: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RemoteTableFile> {
  const remote = normalizeRemoteTableUrl(input);
  let response: Response;
  try {
    response = await fetcher(remote.downloadUrl, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new RemoteTableError("The table could not be downloaded. The remote server may not allow browser access.");
  }
  if (!response.ok) throw new RemoteTableError(`The table download failed with HTTP ${response.status}.`);

  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_TABLE_BYTES) {
    throw new RemoteTableError("The remote table is larger than the 20 MB limit.");
  }

  const text = await response.text();
  const size = new TextEncoder().encode(text).byteLength;
  if (size > MAX_TABLE_BYTES) throw new RemoteTableError("The remote table is larger than the 20 MB limit.");

  return {
    ...remote,
    file: new File([text], remote.fileName, {
      type: remote.fileName.toLowerCase().endsWith(".csv") ? "text/csv" : "text/tab-separated-values",
    }),
  };
}
