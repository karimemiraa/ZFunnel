import { describe, expect, it } from "vitest";
import { contactVars } from "./email";

describe("contactVars", () => {
  it("derives first_name and lowercases custom field keys", () => {
    expect(contactVars({ email: "a@b.co", name: "  Lena Maria Ortiz", fields: { Company: "Acme" } })).toEqual({
      company: "Acme",
      first_name: "Lena",
      name: "  Lena Maria Ortiz",
      email: "a@b.co",
    });
  });

  it("never lets a custom field override built-in variables", () => {
    const v = contactVars({ email: "real@b.co", name: null, fields: { email: "spoof@x.co", first_name: "Spoof" } });
    expect(v.email).toBe("real@b.co");
    expect(v.first_name).toBe("");
  });
});
