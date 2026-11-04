// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initDropzone } from "../../src/ui/dropzone";
import type { AppElements } from "../../src/ui/elements";

interface Harness {
  dropzone: HTMLDivElement;
  reject: HTMLParagraphElement;
  input: HTMLInputElement;
  browse: HTMLButtonElement;
  onFile: ReturnType<typeof vi.fn>;
}

function setup(): Harness {
  const dropzone = document.createElement("div");
  const reject = document.createElement("p");
  reject.hidden = true;
  const input = document.createElement("input");
  input.type = "file";
  const browse = document.createElement("button");
  dropzone.append(browse, reject, input);
  document.body.appendChild(dropzone);
  const onFile = vi.fn();
  initDropzone(
    { dropzone, dropzoneReject: reject, fileInput: input, browseFileBtn: browse } as unknown as AppElements,
    onFile,
  );
  return { dropzone, reject, input, browse, onFile };
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", { value: files, configurable: true });
}

function transfer(files: File[], itemKinds: Array<"file" | "string"> = files.map(() => "file")): DataTransfer {
  return { files, items: itemKinds.map((kind) => ({ kind })) } as unknown as DataTransfer;
}

function drop(target: HTMLElement, dataTransfer: DataTransfer): void {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  target.dispatchEvent(event);
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("initDropzone", () => {
  it("opens the picker from the dropzone and only once from the nested browse button", () => {
    const { dropzone, input, browse } = setup();
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    dropzone.click();
    expect(click).toHaveBeenCalledTimes(1);
    browse.click();
    expect(click).toHaveBeenCalledTimes(2);
  });

  it.each(["subject.TSV", "subject.CSV"])(
    "accepts a picked %s and clears the input to allow picking it again",
    (name) => {
      const { input, onFile } = setup();
      const file = new File(["table"], name);
      setInputFiles(input, [file]);
      input.dispatchEvent(new Event("change"));
      expect(onFile).toHaveBeenCalledWith(file);
      expect(input.value).toBe("");
    },
  );

  it("ignores a picker change with no file", () => {
    const { input, onFile } = setup();
    setInputFiles(input, []);
    input.dispatchEvent(new Event("change"));
    expect(onFile).not.toHaveBeenCalled();
  });

  it("rejects non-table files from both picking and dropping", () => {
    const { dropzone, input, reject, onFile } = setup();
    const textFile = new File(["text"], "notes.txt");
    setInputFiles(input, [textFile]);
    input.dispatchEvent(new Event("change"));
    expect(reject.textContent).toContain("name ends in .tsv or .csv");
    expect(reject.querySelectorAll("br")).toHaveLength(2);

    reject.hidden = true;
    drop(dropzone, transfer([textFile]));
    expect(reject.hidden).toBe(false);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("rejects a multi-file drop instead of silently choosing one", () => {
    const { dropzone, reject, onFile } = setup();
    drop(dropzone, transfer([new File(["a"], "a.tsv"), new File(["b"], "b.tsv")]));
    expect(reject.textContent).toContain("one table at a time");
    expect(onFile).not.toHaveBeenCalled();
  });

  it("explains a drop that contains an item but no file", () => {
    const { dropzone, reject, onFile } = setup();
    drop(dropzone, transfer([], ["string"]));
    expect(reject.textContent).toContain("wasn't a file");
    expect(onFile).not.toHaveBeenCalled();
  });

  it("ignores an empty drop and clears a previous refusal after a valid CSV", () => {
    const { dropzone, reject, onFile } = setup();
    drop(dropzone, transfer([], ["string"]));
    drop(dropzone, transfer([]));
    expect(reject.hidden).toBe(false);

    const csvFile = new File(["csv"], "subject.csv");
    drop(dropzone, transfer([csvFile]));
    expect(reject.hidden).toBe(true);
    expect(onFile).toHaveBeenCalledWith(csvFile);
  });
});
