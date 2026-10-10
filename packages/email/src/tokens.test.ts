import { beforeAll, describe, expect, it } from "vitest";
import { signToken, signValue, verifyToken, verifyValue } from "./tokens";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
});

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("tokens", () => {
  it("round-trips and binds the token to its purpose", () => {
    expect(verifyToken("l", signToken("l", id))).toBe(id);
    expect(verifyToken("u", signToken("l", id))).toBeNull();
  });

  it("signs values containing separators and rejects tampering", () => {
    const v = `${id}:${id}:1999999999`;
    const t = signValue("cust", v);
    expect(verifyValue("cust", t)).toBe(v);
    expect(verifyValue("other", t)).toBeNull();
    expect(verifyValue("cust", t.replace("1999999999", "2999999999"))).toBeNull();
    expect(verifyValue("cust", "garbage")).toBeNull();
  });
});
