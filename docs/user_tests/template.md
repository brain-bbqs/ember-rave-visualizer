# User test checklist

|            |         |
| ---------- | ------- |
| **Tester** | <enter> |
| **Date**   | <enter> |

Run this checklist on the deployed site and record any failures under **Extra notes**.

## Loading electrode coordinates

- [ ] Dropping a valid electrode CSV loads its contacts into the MNI152 viewer
- [ ] Browsing for the same CSV produces the same result
- [ ] A non-CSV file, multiple files, and a CSV missing required columns each show a useful refusal
- [ ] A public raw CSV URL loads successfully
- [ ] A GitHub `/blob/` CSV URL is converted and loads successfully
- [ ] Removing electrodes clears the viewer and returns the loader to its idle state

## RAVE viewer

- [ ] The MNI152 template appears without using the old RAVE drag-and-drop control
- [ ] Rotation, zoom, slice panels, and RAVE display controls work
- [ ] Electrode labels and positions match the loaded CSV
- [ ] Loading a second CSV replaces the first file's contacts

## Cross-cutting

- [ ] The app is usable in light and dark themes, and the viewer background follows the selected theme
- [ ] Phone, tablet, and desktop widths do not produce page-level horizontal overflow
- [ ] Reloading does not leave stale electrode data or other local state
- [ ] The browser console has no unexpected errors
- [ ] Footer links work, and What's New opens with version 0.1.0

## Extra notes
