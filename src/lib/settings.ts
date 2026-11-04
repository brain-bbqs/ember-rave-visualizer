import { createArchiveSettingsStore, type StoredArchiveSettings } from "@brain-bbqs/ember-client";

// Both keys are also read before first paint by the script configs/vite.config.ts injects into
// index.html. Renaming STORAGE_KEY would sign every visitor out on the next deploy.
export const STORAGE_KEY = "ember-rave-visualizer.settings.v1";
export const THEME_KEY = "ember-rave-visualizer.theme";

// The OAuth token set lives in here, in localStorage: an accepted, documented trade-off for a
// backend-free page (see SECURITY.md, "OAuth token lifecycle").
export const settingsStore = createArchiveSettingsStore<StoredArchiveSettings>(STORAGE_KEY);
