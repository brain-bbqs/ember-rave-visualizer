import { createOAuthClient } from "@brain-bbqs/ember-client";

// This app's own public (PKCE, no client secret) OAuth2 application on the EMBER archive, kept
// separate from clip-extractor's and bbqs-uploader's so each tool can be revoked and audited on its
// own. The redirect URI is the client's default, computed at runtime from wherever the page is
// served (production, a PR preview, local dev), and every such location has to be registered on the
// application before sign-in works from there (see docs/README.md).
export const OAUTH_CLIENT_ID = "WjVWvWBVkGgsBI7G8hSKqabn0jkWntvgUpGfOppi";

// Where a pending login's PKCE verifier and state wait in sessionStorage between the redirect out
// and the callback back. Renaming it would drop a sign-in that is mid-redirect across a deploy.
export const OAUTH_PKCE_STORAGE_KEY = "ember-rave-visualizer.oauth-pkce.v1";

export const oauth = createOAuthClient({ clientId: OAUTH_CLIENT_ID, storageKey: OAUTH_PKCE_STORAGE_KEY });
