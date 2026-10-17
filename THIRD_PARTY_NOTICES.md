# Third-party notices

## RAVE MNI152 viewer

`public/vendor/rave/RAVE_MNI_template.html` was supplied as a self-contained RAVE MNI152 viewer.
Its original SHA-256 digest was `936f3ff65ae9af758437696932c26f8176f5afdbd88760a8b5da7c42bf6583e4`.
After adding the adapter described below, the distributed file's SHA-256 digest is `a2778046801ea8392a6a11dd28bf40b0c15627c52b05dfd14a3e69028bf4a54b`.

The bundled RAVE/three-brain-js engine is licensed under the Mozilla Public License 2.0.
The widget identifies its runtime as `three-brain-1.0.0`.
The full terms are in [`LICENSES/MPL-2.0.txt`](LICENSES/MPL-2.0.txt), and the matching 1.0.0 source snapshot is available at [three-brain-js commit `26b73b6`](https://github.com/dipterix/three-brain-js/tree/26b73b661017891c866ae51e9a488a76127dc4d1).

The engine bundle itself is unchanged.
This app only sets the generated widget's `custom_javascript` adapter to expose the initialized viewer, hide the engine's original upload control, and announce readiness to the parent page.

## MNI152 template data

The viewer embeds the `cvs_avg35_inMNI152` template brain and related atlas data.
Those materials are third-party data and are not relicensed under this application's MIT license.
The viewer's creator identified the FreeSurfer software license as the likely applicable license for the template.
See [`LICENSES/LicenseRef-MNI152-Template.txt`](LICENSES/LicenseRef-MNI152-Template.txt) before redistributing or reusing those data separately.

## RAVE documentation

The accepted CSV schema and integration behavior follow the RAVE documentation by Zhengjia Wang, published under CC BY 4.0.
The relevant examples are [Make a group brain](https://github.com/rave-ieeg/rave-ieeg.github.io/blob/af4c65be7b2b64c75997ffd9424a87d35fc70d76/posts/3dviewer/viewer301.qmd) and [Bring Your Own Electrodes](https://github.com/rave-ieeg/rave-ieeg.github.io/blob/main/posts/image_widgets/dnd_electrode_basic.qmd).
