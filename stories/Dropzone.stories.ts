import { withCard, withTheme } from "./utils";

type DropzoneState = "idle" | "dragover" | "rejected";

// Kept in sync with the electrode table dropzone and refusal text.
function buildDropzone(state: DropzoneState): HTMLElement {
  const dz = document.createElement("div");
  dz.id = "dropzone";
  dz.className = "dropzone";
  if (state === "dragover") dz.classList.add("dragover");
  dz.innerHTML = `
    <div class="dz-inner">
      <div class="dz-icon"><span aria-hidden="true">📋</span></div>
      <p>
        Drop a table here, or click to browse
        <button type="button" class="dz-browse">files</button>.
      </p>
      <p class="dz-hint">The file is only loaded locally and is never uploaded to EMBER.</p>
      <p class="dz-reject" ${state === "rejected" ? "" : "hidden"}>
        That file is not a table.<br /><br />Choose a file whose name ends in .tsv or .csv.
      </p>
    </div>
  `;
  return withCard(dz);
}

export default {
  title: "Components/Dropzone",
};

export const IdleLight = {
  name: "Idle (light)",
  render: () => withTheme("light", () => buildDropzone("idle")),
};

export const IdleDark = {
  name: "Idle (dark)",
  render: () => withTheme("dark", () => buildDropzone("idle")),
};

export const DragOverLight = {
  name: "Drag over (light)",
  render: () => withTheme("light", () => buildDropzone("dragover")),
};

export const DragOverDark = {
  name: "Drag over (dark)",
  render: () => withTheme("dark", () => buildDropzone("dragover")),
};

export const RejectedLight = {
  name: "Non-table rejected (light)",
  render: () => withTheme("light", () => buildDropzone("rejected")),
};

export const RejectedDark = {
  name: "Non-table rejected (dark)",
  render: () => withTheme("dark", () => buildDropzone("rejected")),
};
