import { describe, expect, it } from "vitest";
import { csvCell, parseCsv } from "./csv";

describe("csv", () => {
  it("parses quotes, escaped quotes and newlines", () => {
    expect(parseCsv('email,name\r\na@x.com,"Doe, Jane"\nb@x.com,"Say ""hi"""\n')).toEqual([
      ["email", "name"],
      ["a@x.com", "Doe, Jane"],
      ["b@x.com", 'Say "hi"'],
    ]);
  });
  it("detects semicolons and skips blank lines", () => {
    expect(parseCsv("email;name\n\na@x.com;Ann")).toEqual([
      ["email", "name"],
      ["a@x.com", "Ann"],
    ]);
  });
  it("escapes cells and blocks formula injection", () => {
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
  });
});
