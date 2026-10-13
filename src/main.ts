import "./style.css";
import { initThemeToggle, initWhatsNew, renderVersion } from "@brain-bbqs/ui";
import { humanSize } from "@brain-bbqs/utils";
import changelog from "../CHANGELOG.md?raw";
import { THEME_KEY } from "./lib/settings";
import { readTestInjection, synthesizeMockFile } from "./lib/testInjection";
import { initDropzone } from "./ui/dropzone";
import { getElements, getShell } from "./ui/elements";

const shell = getShell();
const els = getElements();

// ---------------------------------------------------------------------------------------------
// The shared shell: the footer version stamp, the "What's New" modal and the light/dark toggle.
// Every BBQS companion app carries these three, wired the same way; what follows them is the app.
// ---------------------------------------------------------------------------------------------

renderVersion(shell.versionIndicator, __APP_VERSION__);

initWhatsNew(els.whatsNew, { changelog });

// The inline script in index.html already applied any stored theme override before first paint,
// so the toggle only has to flip and persist it, under the key that script reads.
initThemeToggle(shell.themeToggle, { storageKey: THEME_KEY });

// ---------------------------------------------------------------------------------------------
// The app: what happens to a loaded file. This is the part the setup skill replaces.
// ---------------------------------------------------------------------------------------------

/** Swaps the picker card for the loaded-file card, naming what was loaded. */
function showLoadedFile(file: File): void {
  els.fileSummaryName.textContent = file.name;
  els.fileSummaryStats.textContent = file.type ? `${humanSize(file.size)} · ${file.type}` : humanSize(file.size);
  els.loadCard.hidden = true;
  els.fileCard.hidden = false;
}

/** Back to the picker, as if nothing had been loaded. */
function resetFile(): void {
  els.fileCard.hidden = true;
  els.loadCard.hidden = false;
  els.fileSummaryName.textContent = "";
  els.fileSummaryStats.textContent = "";
}

initDropzone(els, showLoadedFile);
els.changeFileBtn.addEventListener("click", resetFile);

// `?test&mock_file` lands straight on the loaded state (see lib/testInjection.ts); with no
// injection the page boots for real, on the picker.
const injection = readTestInjection(window.location.search);
if (injection?.mockFile) showLoadedFile(synthesizeMockFile());
