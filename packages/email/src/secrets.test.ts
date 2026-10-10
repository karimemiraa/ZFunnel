import { beforeAll, describe, expect, it } from "vitest";
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
