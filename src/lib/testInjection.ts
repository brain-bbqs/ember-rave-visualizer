export interface TestInjection {
  mockCsv: boolean;
  fakeViewer: boolean;
  sourceUrl: boolean;
}

export function readTestInjection(search: string): TestInjection | null {
  const params = new URLSearchParams(search);
  if (!params.has("test")) return null;
  const mockCsv = params.has("mock_csv");
  return {
    mockCsv,
    fakeViewer: mockCsv || params.has("fake_viewer"),
    sourceUrl: params.has("source_url"),
  };
}

export const MOCK_CSV_NAME = "test-injection-mock-electrodes.csv";

export function synthesizeMockCsv(): File {
  const csv = [
    "Electrode,MNI152_x,MNI152_y,MNI152_z,Label,Group,Radius",
    "1,-28.23,15.38,-39.43,TEST-A1,TEST-A,1",
    "2,-33.50,16.10,-36.69,TEST-A2,TEST-A,1",
  ].join("\n");
  return new File([csv], MOCK_CSV_NAME, { type: "text/csv" });
}
