# Live testing

## Live test injections

| URL                            | What it should look like                                            | Try it                                                                            |
| ------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `?test&fake_viewer`            | The default local-file picker above a labelled deterministic viewer | [Open](https://ember-rave-visualizer.brain-bbqs.org/?test&fake_viewer)            |
| `?test&fake_viewer&source_url` | The remote-URL source pane                                          | [Open](https://ember-rave-visualizer.brain-bbqs.org/?test&fake_viewer&source_url) |
| `?test&mock_csv`               | A fixed, valid two-electrode CSV shown as loaded                    | [Open](https://ember-rave-visualizer.brain-bbqs.org/?test&mock_csv)               |

`?test` alone is a no-op.

The fake viewer replaces only the large WebGL engine at its adapter boundary, so UI tests stay deterministic while real file validation and rendering state remain unchanged.
The mock file is named `test-injection-mock-electrodes.csv` and travels through the same validation and load-state code as a real file.
No injection writes to browser storage or contacts a remote service.

## Local development

```bash
npm ci
npm run dev
```

The production site is deployed from `main` to the `gh-pages` branch by `.github/workflows/deploy.yml`.
The repository's GitHub Pages source must be configured to use that branch and the custom domain `ember-rave-visualizer.brain-bbqs.org`.
