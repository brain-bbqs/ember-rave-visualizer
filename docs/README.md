# Live testing

## Live test injections

| URL                            | What it should look like                                            | Try it                                                                                  |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `?test&fake_viewer`            | The default local-file picker above a labelled deterministic viewer | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer)            |
| `?test&fake_viewer&source_url` | The remote-URL source pane                                          | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&fake_viewer&source_url) |
| `?test&mock_table`             | A fixed, valid two-electrode table shown as loaded                  | [Open](https://brain-bbqs.github.io/ember-rave-visualizer/?test&mock_table)             |

`?test` alone is a no-op.

The fake viewer replaces only the large WebGL engine at its adapter boundary, so UI tests stay deterministic while real file validation and rendering state remain unchanged.
The mock file is named `test-injection-mock-electrodes.tsv` and travels through the same validation and load-state code as a real file.
No injection writes to browser storage or contacts a remote service.

## Local development

```bash
npm ci
npm run dev
```

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

## Deployment

The production site is deployed from `main` to the `gh-pages` branch by `.github/workflows/deploy.yml`.
The repository's GitHub Pages source must be configured to serve the root of that branch at `https://brain-bbqs.github.io/ember-rave-visualizer/`.
