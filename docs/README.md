# Live testing

## Live test injections

| URL                                            | What it should look like                                                            | Try it                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `?test&fake_viewer`                            | The default local-file picker above a labelled deterministic viewer                 | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer)                            |
| `?test&fake_viewer&source_url`                 | The remote-URL source pane                                                          | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer&source_url)                 |
| `?test&mock_table`                             | A fixed, valid two-electrode table shown as loaded                                  | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&mock_table)                             |
| `?test&fake_viewer&source_ember`               | Browse EMBER, reading the real archive                                              | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer&source_ember)               |
| `?test&fake_viewer&remote_listing=7`           | Browse EMBER on a fake listing of 7 tables in 3 datasets (6 when no count is given) | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer&remote_listing=7)           |
| `?test&fake_viewer&signed_in&remote_listing=7` | The same, under a fake account, with the last dataset marked embargoed              | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer&signed_in&remote_listing=7) |
| `?test&fake_viewer&signed_out`                 | Every surface signed out, even over a real stored sign-in                           | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer&signed_out)                 |

`?test` alone is a no-op.

The fake viewer replaces only the large WebGL engine at its adapter boundary, so UI tests stay deterministic while real file validation and rendering state remain unchanged.
The mock file is named `test-injection-mock-electrodes.tsv` and travels through the same validation and load-state code as a real file.
The fake listing's tables live under `test-injection.invalid`, so picking one ends in the ordinary download refusal; an embargoed one asks for a real sign-in instead.
`signed_in` fills the header with a fake account (`test-user`, "Live Smoketest") and holds no token, so it never calls the archive; `signed_out` wins when both are given.
No injection writes to browser storage, and only `source_ember` contacts a remote service.

## Local development

```bash
npm ci
npm run dev
```

## EMBER sign-in

Sign-in uses this app's own public OAuth application on the EMBER archive (client id in `src/lib/oauth.ts`; Authorization Code grant, public client, no secret, PKCE).
The app sends the archive back to wherever it is served from (`origin + pathname`), so each location that should be able to sign in has to be listed among that application's redirect URIs:

- `https://brain-bbqs.github.io/ember-rave-visualizer/` for production;
- `https://brain-bbqs.github.io/ember-rave-visualizer/pr-preview/pr-N/` for a pull request's preview, as needed;
- `http://localhost:5173/` for `npm run dev`.

Browsing public datasets needs no sign-in at all; signing in adds the embargoed datasets the visitor owns.
The token lifecycle is in `SECURITY.md`.

## Updating the vendored viewer

`public/vendor/rave/` holds RAVE's MNI152 viewer, split out of the self-contained HTML export RAVE writes.
The export embeds its template data as about 57 MB of base64; the split keeps the page to 2.6 MB and stores the data as separate files in `data/`, gzip-compressed apart from the JSON files (which Pages compresses on the wire) and the `.mgz` volumes (which are compressed already).
Stored names also drop leading underscores (`__global_data` becomes `global_data`), because Jekyll on GitHub Pages leaves such paths out of the site.
The template parts in `DROPPED_PARTS` (`scripts/raveViewerData.ts`), surfaces, atlases and surface annotations by name, are left out altogether: the page loads a trimmed copy of the export's config, `ember-config_….json`, that no longer lists them.
A short script the split adds to the page maps the engine's requests to the stored files and inflates the compressed ones as they arrive.

To replace the viewer, split the new export with Node 22.18 or later, which runs the TypeScript directly:

```bash
node scripts/split-rave-viewer.ts path/to/viewer-export.html
```

This rewrites `RAVE_MNI_template.html`, `data/` and `manifest.json`, and applies the widget settings listed in `scripts/raveViewerData.ts`.
Then set `ORIGINAL_SHA256` in `tests/unit/vendorIntegrity.test.ts` to the new export's digest (`manifest.json` records it), and update the viewer section of `THIRD_PARTY_NOTICES.md`.

To change only those settings, such as the viewer adapter that lays the view out for the frame, edit them in `scripts/raveViewerData.ts` and write them into the page already there:

```bash
node scripts/reapply-rave-settings.ts
```

## Deployment

The production site is deployed from `main` to the `gh-pages` branch by `.github/workflows/deploy.yml`.
The repository's GitHub Pages source must be configured to serve the root of that branch at `https://brain-bbqs.github.io/ember-rave-visualizer/`.
