export const MAX_CSV_BYTES = 20 * 1024 * 1024;

const REQUIRED_COLUMNS = ["Electrode", "MNI152_x", "MNI152_y", "MNI152_z", "Label"] as const;
const COORDINATE_COLUMNS = ["MNI152_x", "MNI152_y", "MNI152_z"] as const;

export interface ElectrodeCsvSummary {
  name: string;
  rowCount: number;
  columnCount: number;
}

export class ElectrodeCsvError extends Error {
  override name = "ElectrodeCsvError";
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = (): void => {
    row.push(field);
    field = "";
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) throw new ElectrodeCsvError("A CSV field contains an unexpected quote.");
      quoted = true;
    } else if (character === ",") {
      endField();
    } else if (character === "\n") {
      endRow();
    } else if (character === "\r") {
      if (text[index + 1] === "\n") index += 1;
      endRow();
    } else {
      field += character;
    }
  }

  if (quoted) throw new ElectrodeCsvError("The CSV ends inside a quoted field.");
  if (field.length > 0 || row.length > 0 || text.endsWith(",")) endRow();
  return rows;
}

function finiteNumber(value: string, column: string, rowNumber: number): number {
  if (value.trim() === "") throw new ElectrodeCsvError(`Row ${rowNumber} has no value for ${column}.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ElectrodeCsvError(`Row ${rowNumber} has a non-numeric ${column} value.`);
  return parsed;
}

export function validateElectrodeCsv(text: string, name = "electrodes.csv"): ElectrodeCsvSummary {
  const rows = parseCsv(text).filter((row) => row.some((field) => field.trim() !== ""));
  if (rows.length < 2) throw new ElectrodeCsvError("The CSV must contain a header and at least one electrode row.");

  const header = rows[0].map((column, index) => (index === 0 ? column.replace(/^\uFEFF/, "") : column));
  const duplicates = header.filter((column, index) => header.indexOf(column) !== index);
  if (duplicates.length > 0) throw new ElectrodeCsvError(`The CSV repeats the ${duplicates[0]} column.`);

  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new ElectrodeCsvError(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  }

  const columnIndex = new Map(header.map((column, index) => [column, index]));
  const electrodeIndex = columnIndex.get("Electrode") as number;
  const labelIndex = columnIndex.get("Label") as number;
  const radiusIndex = columnIndex.get("Radius");
  const seenElectrodes = new Set<number>();

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.length > header.length) throw new ElectrodeCsvError(`Row ${rowNumber} has more fields than the header.`);

    const electrode = finiteNumber(row.at(electrodeIndex) ?? "", "Electrode", rowNumber);
    if (!Number.isInteger(electrode))
      throw new ElectrodeCsvError(`Row ${rowNumber} has a non-integer Electrode value.`);
    if (seenElectrodes.has(electrode)) throw new ElectrodeCsvError(`Electrode ${electrode} appears more than once.`);
    seenElectrodes.add(electrode);

    if ((row.at(labelIndex) ?? "").trim() === "") throw new ElectrodeCsvError(`Row ${rowNumber} has no Label.`);
    const coordinates = COORDINATE_COLUMNS.map((column) =>
      finiteNumber(row.at(columnIndex.get(column) as number) ?? "", column, rowNumber),
    );
    if (coordinates.every((coordinate) => coordinate === 0)) {
      throw new ElectrodeCsvError(`Row ${rowNumber} is at the origin, which RAVE treats as a missing position.`);
    }

    if (radiusIndex !== undefined && (row.at(radiusIndex) ?? "").trim() !== "") {
      const radius = finiteNumber(row.at(radiusIndex) ?? "", "Radius", rowNumber);
      if (radius <= 0) throw new ElectrodeCsvError(`Row ${rowNumber} has a Radius that is not greater than zero.`);
    }
  });

  return { name, rowCount: rows.length - 1, columnCount: header.length };
}

export async function readElectrodeCsv(file: File): Promise<ElectrodeCsvSummary> {
  if (!file.name.toLowerCase().endsWith(".csv")) throw new ElectrodeCsvError("Choose a file whose name ends in .csv.");
  if (file.size > MAX_CSV_BYTES) throw new ElectrodeCsvError("The CSV is larger than the 20 MB limit.");
  return validateElectrodeCsv(await file.text(), file.name);
}
