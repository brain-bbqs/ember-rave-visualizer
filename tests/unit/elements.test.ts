// @vitest-environment jsdom
// The index.html/elements.ts id contract, checked both ways: every id a lookup requires is in the
// page, and every id in the page is registered by a lookup (or referenced by the page itself).
import { expectIdContract, readIndexHtml } from "@brain-bbqs/test-utils/vitest";
import { describe, it } from "vitest";
import { getElements, getShell } from "../../src/ui/elements";

describe("element lookups", () => {
  it("index.html and the element lookups agree", () => {
    expectIdContract({ html: readIndexHtml(), lookups: [getShell, getElements] });
  });
});
