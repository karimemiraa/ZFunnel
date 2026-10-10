import { describe, expect, it } from "vitest";
import { slugSchema } from "./schemas";
import { slugify } from "./slug";

describe("slugify", () => {
  it("normalizes names into DNS labels", () => {
    expect(slugify("  Zeal Marketing GmbH! ")).toBe("zeal-marketing-gmbh");
    expect(slugify("Café Über")).toBe("cafe-uber");
    expect(slugify("a".repeat(60))).toHaveLength(48);
  });
});

describe("slugSchema", () => {
  it("rejects reserved and malformed slugs", () => {
    expect(slugSchema.safeParse("app").success).toBe(false);
    expect(slugSchema.safeParse("-bad").success).toBe(false);
    expect(slugSchema.safeParse("Upper").success).toBe(false);
    expect(slugSchema.safeParse("my-funnel").success).toBe(true);
  });
});
