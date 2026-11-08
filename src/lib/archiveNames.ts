// A local cache of dataset titles read out of EMBER's `dandiset.jsonld` manifests, as in
// clip-extractor. Titles are what make the browse list searchable, and reading them all is a short
// pause the first time and nothing every time after. Only identifiers and titles of public datasets
// are stored; nothing about the signed-in visitor or the datasets they own goes in.

const STORAGE_KEY = "ember-rave-visualizer.archive-names.v1";

/** Datasets are renamed rarely, and a stale title only affects what the filter matches. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface NameCacheFile {
  savedAt?: number;
  names?: Record<string, string>;
}

function readFile(): NameCacheFile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NameCacheFile) : {};
  } catch (error) {
    console.warn("Could not read the cached dataset names:", error);
    return {};
  }
}

/** The titles held, or an empty map when there are none or they have aged out. */
export function loadCachedNames(now: number = Date.now()): Map<string, string> {
  const cached = readFile();
  if (!cached.names || !cached.savedAt || now - cached.savedAt > MAX_AGE_MS) return new Map();
  return new Map(Object.entries(cached.names));
}

/** Replaces the titles held, so a dataset that has left the archive drops out of the cache too. */
export function saveCachedNames(names: ReadonlyMap<string, string>, now: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: now, names: Object.fromEntries(names) }));
  } catch (error) {
    console.warn("Could not cache the dataset names:", error);
  }
}
