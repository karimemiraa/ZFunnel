import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./secrets";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
});

describe("secrets", () => {
  it("round-trips and detects tampering", () => {
    const s = sealSecret("twilio-token-123");
    expect(s).not.toContain("twilio");
    expect(openSecret(s)).toBe("twilio-token-123");
    const parts = s.split(".");
    parts[3] = parts[3]!.slice(0, -2) + (parts[3]!.endsWith("A") ? "BB" : "AA");
    expect(openSecret(parts.join("."))).toBeNull();
    expect(openSecret("garbage")).toBeNull();
  });
});

describe("secrets key selection", () => {
  const saved = process.env.SECRETS_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.SECRETS_KEY;
    else process.env.SECRETS_KEY = saved;
    process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret";
  });

  it("treats an empty SECRETS_KEY as unset (compose passes one when it isn't configured)", () => {
    process.env.SECRETS_KEY = "";
    const sealed = sealSecret("tok");
    // Sealed with BETTER_AUTH_SECRET, not with a key derived from the empty string.
    process.env.SECRETS_KEY = "test-secret-test-secret-test-secret";
    expect(openSecret(sealed)).toBe("tok");
    process.env.SECRETS_KEY = "something-else";
    expect(openSecret(sealed)).toBeNull();
  });

  it("refuses to work without any key", () => {
    process.env.SECRETS_KEY = "";
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => sealSecret("tok")).toThrow();
  });
});
