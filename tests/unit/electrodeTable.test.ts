// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  ElectrodeTableError,
  isTableFileName,
  MAX_TABLE_BYTES,
  readElectrodeTable,
  tableDelimiter,
  validateElectrodeTable,
} from "../../src/lib/electrodeTable";

const HEADER = "Electrode\tMNI152_x\tMNI152_y\tMNI152_z\tLabel";

function tsv(row = "1\t-8.2\t4.2\t30.1\tA1"): string {
  return `${HEADER}\n${row}`;
}

function readableFile(parts: BlobPart[], name: string): File {
  const file = new File(parts, name, { type: "text/tab-separated-values" });
  if (!("text" in file)) {
    Object.defineProperty(file, "text", {
      value: () =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
          reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read the test file.")));
          reader.readAsText(file);
        }),
    });
  }
  return file;
}

describe("tableDelimiter", () => {
  it.each([
    ["a tab-separated header", HEADER, "\t"],
    ["a comma-separated header", "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,1,2,3,A1", ","],
    ["a header with tabs and commas", "Electrode\tLabel,Name\n1\tA,1", "\t"],
    ["a header with neither", "Electrode\n1", "\t"],
    ["an empty document", "", "\t"],
  ])("reads %s as %j", (_case, text, delimiter) => {
    expect(tableDelimiter(text)).toBe(delimiter);
  });
});

describe("isTableFileName", () => {
  it.each([
    ["subject.tsv", true],
    ["subject.TSV", true],
    ["subject.csv", true],
    ["subject.txt", false],
    ["subject.tsv.gz", false],
  ])("treats %s as a table: %s", (name, expected) => {
    expect(isTableFileName(name)).toBe(expected);
  });
});

describe("validateElectrodeTable", () => {
  it("accepts the documented RAVE columns as TSV, with a BOM, CRLF, and blank rows", () => {
    const input = `\uFEFF${HEADER}\tRadius\tNote\r\n1\t-8.2\t4.2\t30.1\tA, one\t1\tok\r\n\r\n`;
    expect(validateElectrodeTable(input, "subject.tsv")).toEqual({
      name: "subject.tsv",
      rowCount: 1,
      columnCount: 7,
    });
  });

  it("still accepts CSV, including quoted fields", () => {
    const input = 'Electrode,MNI152_x,MNI152_y,MNI152_z,Label,Note\n1,-8.2,4.2,30.1,"A, ""one""","ok"';
    expect(validateElectrodeTable(input, "PAV080.csv")).toEqual({ name: "PAV080.csv", rowCount: 1, columnCount: 6 });
  });

  it("accepts a final empty field and optional blank Radius", () => {
    expect(validateElectrodeTable(`${HEADER}\tRadius\tNote\n1\t1\t2\t3\tA1\t\t`)).toMatchObject({
      rowCount: 1,
      columnCount: 7,
    });
  });

  it.each([
    ["a header without data", HEADER, "header and at least one"],
    ["an empty document", "", "header and at least one"],
    ["an unexpected quote", tsv('1\t1\t2\t3\tA"1'), "unexpected quote"],
    ["an unterminated quote", tsv('1\t1\t2\t3\t"A1'), "inside a quoted field"],
    ["a duplicate column", `${HEADER}\tLabel\n1\t1\t2\t3\tA1\tA1`, "repeats the Label column"],
    ["a missing column", "Electrode\tMNI152_x\tMNI152_y\tLabel\n1\t1\t2\tA1", "Missing required column: MNI152_z"],
    ["several missing columns", "Electrode\tLabel\n1\tA1", "Missing required columns: MNI152_x, MNI152_y, MNI152_z"],
    ["too many fields", tsv("1\t1\t2\t3\tA1\textra"), "more fields than the header"],
    ["a blank electrode", tsv("\t1\t2\t3\tA1"), "no value for Electrode"],
    ["a non-numeric electrode", tsv("nope\t1\t2\t3\tA1"), "non-numeric Electrode"],
    ["a fractional electrode", tsv("1.5\t1\t2\t3\tA1"), "non-integer Electrode"],
    ["a duplicate electrode", `${HEADER}\n1\t1\t2\t3\tA1\n1\t4\t5\t6\tA2`, "Electrode 1 appears more than once"],
    ["a blank label", tsv("1\t1\t2\t3\t"), "has no Label"],
    ["a blank coordinate", tsv("1\t1\t\t3\tA1"), "no value for MNI152_y"],
    ["a non-numeric coordinate", tsv("1\t1\tside\t3\tA1"), "non-numeric MNI152_y"],
    ["an origin coordinate", tsv("1\t0\t0\t0\tA1"), "RAVE treats as a missing position"],
    ["a zero radius", `${HEADER}\tRadius\n1\t1\t2\t3\tA1\t0`, "Radius that is not greater than zero"],
  ])("rejects %s", (_case, input, message) => {
    expect(() => validateElectrodeTable(input)).toThrow(message);
  });

  it("uses a dedicated error type", () => {
    expect(() => validateElectrodeTable(HEADER)).toThrow(ElectrodeTableError);
  });
});

describe("readElectrodeTable", () => {
  it.each([
    ["subject.tsv", tsv()],
    ["subject.csv", "Electrode,MNI152_x,MNI152_y,MNI152_z,Label\n1,-8.2,4.2,30.1,A1"],
  ])("reads and names a local %s", async (name, content) => {
    await expect(readElectrodeTable(readableFile([content], name))).resolves.toEqual({
      name,
      rowCount: 1,
      columnCount: 5,
    });
  });

  it("requires a .tsv or .csv extension", async () => {
    await expect(readElectrodeTable(readableFile([tsv()], "subject.txt"))).rejects.toThrow("ends in .tsv or .csv");
  });

  it("enforces the local file size limit before reading", async () => {
    const oversized = readableFile([new Uint8Array(MAX_TABLE_BYTES + 1)], "large.tsv");
    await expect(readElectrodeTable(oversized)).rejects.toThrow("larger than the 20 MB limit");
  });
});
