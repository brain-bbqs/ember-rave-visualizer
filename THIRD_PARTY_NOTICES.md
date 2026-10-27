# Third-party notices

## RAVE MNI152 viewer

The RAVE MNI152 viewer in `public/vendor/rave/` was supplied as one self-contained HTML export.
That export's SHA-256 digest was `936f3ff65ae9af758437696932c26f8176f5afdbd88760a8b5da7c42bf6583e4`.
`scripts/split-rave-viewer.ts` split it into the page `RAVE_MNI_template.html` and the data files it embedded, which now sit in `data/`, gzip-compressed apart from the `.mgz` volumes.
The split leaves out the template's inflated and spherical (`sphere.reg`) surfaces, four of the 19 files, which this app does not use.
`manifest.json` records each data file's original size and digest (the dropped ones included) and the widget settings the split changed, and `tests/unit/vendorIntegrity.test.ts` rebuilds the supplied export, minus the four dropped files, byte for byte.

The bundled RAVE/three-brain-js engine is licensed under the Mozilla Public License 2.0.
The widget identifies its runtime as `three-brain-1.0.0`.
The full terms are in [`LICENSES/MPL-2.0.txt`](LICENSES/MPL-2.0.txt), and the matching 1.0.0 source snapshot is available at [three-brain-js commit `26b73b6`](https://github.com/dipterix/three-brain-js/tree/26b73b661017891c866ae51e9a488a76127dc4d1).

The engine bundle itself is unchanged.
This app changes four of the generated widget's settings and adds one short script to the page:

- `custom_javascript` holds an adapter that exposes the initialized viewer, hides the engine's original upload control, and announces readiness to the parent page.
- `cache_folder` points the engine at `data/` instead of the copies embedded in the page.
- `worker_script` is `null`, because no worker matching this engine build ships with the viewer.
- `data_filename` points at `ember-config_….json`, a copy of the export's config without the dropped surfaces; the original config ships unchanged beside it.
- The added script maps the engine's requests to the stored data files and inflates the compressed ones as they arrive.

## MNI152 template data

The viewer's data files include the `cvs_avg35_inMNI152` template brain and related atlas data.
They are stored gzip-compressed and otherwise unchanged: decompressing them gives back the original bytes.
Those materials are third-party data and are not relicensed under this application's MIT license.
The viewer's creator identified the FreeSurfer software license as the likely applicable license for the template.
See [`LICENSES/LicenseRef-MNI152-Template.txt`](LICENSES/LicenseRef-MNI152-Template.txt) before redistributing or reusing those data separately.

## RAVE documentation

The accepted CSV schema and integration behavior follow the RAVE documentation by Zhengjia Wang, published under CC BY 4.0.
The relevant examples are [Make a group brain](https://github.com/rave-ieeg/rave-ieeg.github.io/blob/af4c65be7b2b64c75997ffd9424a87d35fc70d76/posts/3dviewer/viewer301.qmd) and [Bring Your Own Electrodes](https://github.com/rave-ieeg/rave-ieeg.github.io/blob/main/posts/image_widgets/dnd_electrode_basic.qmd).
