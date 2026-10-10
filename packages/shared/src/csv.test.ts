import { describe, expect, it } from "vitest";
import { contactName, csvCell, mapContactColumns, parseCreatedDate, parseCsv } from "./csv";

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

describe("contact column mapping", () => {
  it("recognises a ClickFunnels classic export", () => {
    const [header, row] = parseCsv(
      "id,email,first_name,last_name,phone,address,city,tags,created_at\n" +
        '12,ann@x.com,Ann,Lee,+15551234,1 Main St,Austin,"vip,webinar",2023-04-05 10:11:12 UTC\n',
    );
    const cols = mapContactColumns(header!);
    expect(cols).toEqual({ email: 1, name: -1, firstName: 2, lastName: 3, phone: 4, tags: 7, createdAt: 8 });
    expect(contactName(row!, cols)).toBe("Ann Lee");
    expect(parseCreatedDate(row![cols.createdAt])?.toISOString()).toBe("2023-04-05T10:11:12.000Z");
  });

  it("recognises a ClickFunnels 2.0 export", () => {
    const header = [
      "ID",
      "First Name",
      "Last Name",
      "Email Address",
      "Phone Number",
      "Time Zone",
      "Contact Tags",
      "Created",
    ];
    expect(mapContactColumns(header)).toEqual({
      email: 3,
      name: -1,
      firstName: 1,
      lastName: 2,
      phone: 4,
      tags: 6,
      createdAt: 7,
    });
  });

  it("still supports the plain ZFunnel headers and a full name column", () => {
    const cols = mapContactColumns(["Email", "Name", "Mobile", "Tag"]);
    expect(cols).toMatchObject({ email: 0, name: 1, phone: 2, tags: 3, createdAt: -1 });
    expect(contactName(["a@x.com", " Jane Doe ", "", ""], cols)).toBe("Jane Doe");
    expect(contactName(["a@x.com", "", "", ""], cols)).toBeNull();
  });

  it("ignores unusable created dates", () => {
    expect(parseCreatedDate("")).toBeNull();
    expect(parseCreatedDate("not a date")).toBeNull();
    expect(parseCreatedDate("2999-01-01")).toBeNull();
    expect(parseCreatedDate("2024-02-29T08:00:00Z")?.toISOString()).toBe("2024-02-29T08:00:00.000Z");
  });
});
