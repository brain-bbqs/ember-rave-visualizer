import { bindDropzone, showDropzoneReject } from "@brain-bbqs/ui";
import { isTableFileName } from "../lib/electrodeTable";
import type { AppElements } from "./elements";

const REJECT_NOT_A_FILE = "That wasn't a file.\n\nDrop one table file, or use the browse button instead.";
const REJECT_MULTIPLE_FILES = "Load one table at a time.\n\nDrop a single electrode coordinate file.";
const REJECT_NOT_TABLE = "That file is not a table.\n\nChoose a file whose name ends in .tsv or .csv.";

export function initDropzone(els: AppElements, onFile: (file: File) => void): void {
  function accept(file: File): void {
    if (!isTableFileName(file.name)) {
      showDropzoneReject(els.dropzoneReject, REJECT_NOT_TABLE);
      return;
    }
    els.dropzoneReject.hidden = true;
    onFile(file);
  }

  bindDropzone(els.dropzone, {
    onDrop: (transfer) => {
      if (transfer.files.length > 1) {
        showDropzoneReject(els.dropzoneReject, REJECT_MULTIPLE_FILES);
      } else {
        const file = transfer.files[0] as File | undefined;
        if (file) accept(file);
        else if (transfer.items.length > 0) showDropzoneReject(els.dropzoneReject, REJECT_NOT_A_FILE);
      }
    },
    input: els.fileInput,
    browseButton: els.browseFileBtn,
    onPick: (files) => accept(files[0]),
  });
}
