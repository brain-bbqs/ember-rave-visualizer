// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ElectrodeCsvError, MAX_CSV_BYTES, readElectrodeCsv, validateElectrodeCsv } from "../../src/lib/electrodeCsv";

const HEADER = "Electrode,MNI152_x,MNI152_y,MNI152_z,Label";

function csv(row = "1,-8.2,4.2,30.1,A1"): string {
  return `${HEADER}\n${row}`;
}

function readableFile(parts: BlobPart[], name: string): File {
  const file = new File(parts, name, { type: "text/csv" });
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

describe("validateElectrodeCsv", () => {
  it("accepts the documented RAVE columns, quoted fields, a BOM, CRLF, and blank rows", () => {
    const input =
      '\uFEFFElectrode,MNI152_x,MNI152_y,MNI152_z,Label,Radius,Note\r\n1,-8.2,4.2,30.1,"A, ""one""",1,"ok"\r\n\r\n';
    expect(validateElectrodeCsv(input, "PAV080.csv")).toEqual({
      name: "PAV080.csv",
      rowCount: 1,
      columnCount: 7,
    });
  });

  it("accepts a final empty field and optional blank Radius", () => {
    expect(validateElectrodeCsv(`${HEADER},Radius,Note\n1,1,2,3,A1,,`)).toMatchObject({
      rowCount: 1,
      columnCount: 7,
    });
  });

  it.each([
    ["a header without data", HEADER, "header and at least one"],
    ["an empty document", "", "header and at least one"],
    ["an unexpected quote", `${HEADER}\n1,1,2,3,A"1`, "unexpected quote"],
    ["an unterminated quote", `${HEADER}\n1,1,2,3,"A1`, "inside a quoted field"],
    ["a duplicate column", `${HEADER},Label\n1,1,2,3,A1,A1`, "repeats the Label column"],
    ["a missing column", "Electrode,MNI152_x,MNI152_y,Label\n1,1,2,A1", "Missing required column: MNI152_z"],
    ["several missing columns", "Electrode,Label\n1,A1", "Missing required columns: MNI152_x, MNI152_y, MNI152_z"],
    ["too many fields", `${HEADER}\n1,1,2,3,A1,extra`, "more fields than the header"],
    ["a blank electrode", csv(",1,2,3,A1"), "no value for Electrode"],
    ["a non-numeric electrode", csv("nope,1,2,3,A1"), "non-numeric Electrode"],
    ["a fractional electrode", csv("1.5,1,2,3,A1"), "non-integer Electrode"],
    ["a duplicate electrode", `${HEADER}\n1,1,2,3,A1\n1,4,5,6,A2`, "Electrode 1 appears more than once"],
    ["a blank label", csv("1,1,2,3,"), "has no Label"],
    ["a blank coordinate", csv("1,1,,3,A1"), "no value for MNI152_y"],
    ["a non-numeric coordinate", csv("1,1,side,3,A1"), "non-numeric MNI152_y"],
    ["an origin coordinate", csv("1,0,0,0,A1"), "RAVE treats as a missing position"],
    ["a zero radius", `${HEADER},Radius\n1,1,2,3,A1,0`, "Radius that is not greater than zero"],
  ])("rejects %s", (_case, input, message) => {
    expect(() => validateElectrodeCsv(input)).toThrow(message);
  });

  it("uses a dedicated error type", () => {
    expect(() => validateElectrodeCsv(HEADER)).toThrow(ElectrodeCsvError);
  });
});

describe("readElectrodeCsv", () => {
  it("reads and names a local CSV", async () => {
    await expect(readElectrodeCsv(readableFile([csv()], "subject.csv"))).resolves.toEqual({
      name: "subject.csv",
      rowCount: 1,
      columnCount: 5,
    });
  });

  it("requires a .csv extension", async () => {
    await expect(readElectrodeCsv(readableFile([csv()], "subject.txt"))).rejects.toThrow("ends in .csv");
  });

  it("enforces the local file size limit before reading", async () => {
    const oversized = readableFile([new Uint8Array(MAX_CSV_BYTES + 1)], "large.csv");
    await expect(readElectrodeCsv(oversized)).rejects.toThrow("larger than the 20 MB limit");
  });
});
