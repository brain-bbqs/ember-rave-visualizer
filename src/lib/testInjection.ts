export interface TestInjection {
  mockTable: boolean;
  fakeViewer: boolean;
  sourceUrl: boolean;
}

export function readTestInjection(search: string): TestInjection | null {
  const params = new URLSearchParams(search);
  if (!params.has("test")) return null;
  const mockTable = params.has("mock_table");
  return {
    mockTable,
    fakeViewer: mockTable || params.has("fake_viewer"),
    sourceUrl: params.has("source_url"),
  };
}

export const MOCK_TABLE_NAME = "test-injection-mock-electrodes.tsv";

export function synthesizeMockTable(): File {
  const table = [
    "Electrode\tMNI152_x\tMNI152_y\tMNI152_z\tLabel\tGroup\tRadius",
    "1\t-28.23\t15.38\t-39.43\tTEST-A1\tTEST-A\t1",
    "2\t-33.50\t16.10\t-36.69\tTEST-A2\tTEST-A\t1",
  ].join("\n");
  return new File([table], MOCK_TABLE_NAME, { type: "text/tab-separated-values" });
}
