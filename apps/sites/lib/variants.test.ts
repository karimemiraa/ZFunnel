import { describe, expect, it } from "vitest";
import { pickVariant, variantCookie } from "./variants";

const vs = [{ id: "b", weight: 30 }];

describe("pickVariant", () => {
  it("shows the original when there is no test", () => {
    expect(pickVariant([], undefined)).toEqual({ id: null, fresh: false });
  });
  it("splits new visitors by weight", () => {
    expect(pickVariant(vs, undefined, 0.1).id).toBe("b");
    expect(pickVariant(vs, undefined, 0.5).id).toBeNull();
    expect(pickVariant(vs, undefined, 0.1).fresh).toBe(true);
  });
  it("keeps returning visitors on their variant", () => {
    expect(pickVariant(vs, "a", 0.01)).toEqual({ id: null, fresh: false });
    expect(pickVariant(vs, "b", 0.99)).toEqual({ id: "b", fresh: false });
  });
  it("reassigns when the cookie points to a removed variant", () => {
    expect(pickVariant(vs, "gone", 0.1)).toEqual({ id: "b", fresh: true });
  });
  it("names cookies per step", () => {
    expect(variantCookie("123e4567-e89b-12d3-a456-426614174000")).toBe("zfv_123e4567e89b12d3");
  });
});
