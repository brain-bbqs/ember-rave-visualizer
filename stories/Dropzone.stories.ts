import { withCard, withTheme } from "./utils";

type DropzoneState = "idle" | "dragover" | "rejected";

// Kept in sync with the electrode CSV dropzone and refusal text.
function buildDropzone(state: DropzoneState): HTMLElement {
  const dz = document.createElement("div");
  dz.id = "dropzone";
  dz.className = "dropzone";
  if (state === "dragover") dz.classList.add("dragover");
  dz.innerHTML = `
    <div class="dz-inner">
      <div class="dz-icon">
        <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor"
          stroke-width="1.7" aria-hidden="true">
          <path d="M4 3h11l5 5v13H4z" />
          <path d="M15 3v5h5M8 13h8M8 17h8" />
        </svg>
      </div>
      <p>
        Drop an electrode CSV here, or
        <button type="button" class="dz-browse">browse for a file</button>.
      </p>
      <p class="dz-hint">The file is read locally and never uploaded.</p>
      <p class="dz-reject" ${state === "rejected" ? "" : "hidden"}>
        That file is not a CSV.<br /><br />Choose a file whose name ends in .csv.
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
  name: "Non-CSV rejected (light)",
  render: () => withTheme("light", () => buildDropzone("rejected")),
};

export const RejectedDark = {
  name: "Non-CSV rejected (dark)",
  render: () => withTheme("dark", () => buildDropzone("rejected")),
};
