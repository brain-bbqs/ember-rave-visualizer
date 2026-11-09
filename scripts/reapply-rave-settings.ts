/// <reference types="node" />
// Rewrites the split RAVE viewer page with the widget settings in scripts/raveViewerData.ts (the
// viewer adapter among them), leaving its data files and manifest as they are.
// Usage: node scripts/reapply-rave-settings.ts [viewer-dir]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { reapplySettings } from "./raveViewerData.ts";

const [output = "public/vendor/rave"] = process.argv.slice(2);
const page = resolve(output, "RAVE_MNI_template.html");
writeFileSync(page, reapplySettings(readFileSync(page, "utf8")));
console.log(`Applied the distributed settings to ${page}.`);
