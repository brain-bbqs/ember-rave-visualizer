import { bindDropzone, showDropzoneReject } from "@brain-bbqs/ui";
import type { AppElements } from "./elements";

// A blank line (\n\n) renders as <br><br>; see showDropzoneReject. Splitting the "what went wrong"
// and "what to do instead" halves onto their own lines keeps the fix visible at a glance.
const REJECT_NOT_A_FILE = "That wasn't a file.\n\nDrop a single file, or use the browse button instead.";

/**
 * Wires the file dropzone: a click anywhere on it (or on its browse button) opens the file picker,
 * and a drag-and-drop of one file hands that file to `onFile`. Only the first file of a multi-file
 * drop is taken; anything droppable that is not a file (dragged text, a link) is refused with an
 * explanation rather than silently ignored. The drag, click and window-guard plumbing is
 * @brain-bbqs/ui's `bindDropzone`; what a drop or a pick means stays here.
 */
export function initDropzone(els: AppElements, onFile: (file: File) => void): void {
  function accept(file: File): void {
    els.dropzoneReject.hidden = true;
    onFile(file);
  }

  bindDropzone(els.dropzone, {
    onDrop: (transfer) => {
      const file = transfer.files[0] as File | undefined;
      if (file) {
        accept(file);
      } else if (transfer.items.length > 0) {
        showDropzoneReject(els.dropzoneReject, REJECT_NOT_A_FILE);
      }
    },
    input: els.fileInput,
    browseButton: els.browseFileBtn,
    onPick: (files) => accept(files[0]),
  });
}
