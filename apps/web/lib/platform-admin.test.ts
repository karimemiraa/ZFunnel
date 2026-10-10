import { describe, expect, it } from "vitest";
import { isPlatformAdminUser, parseAdminEmails, signViewAs, verifyViewAs, type ViewAsClaim } from "./platform-admin";

describe("parseAdminEmails", () => {
  it("splits, trims and lowercases", () => {
    expect([...parseAdminEmails(" Karim@ZealMarketing.net , ops@example.com,,")]).toEqual([
      "karim@zealmarketing.net",
      "ops@example.com",
    ]);
  });
  it("is empty when unset or junk", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails("").size).toBe(0);
    expect(parseAdminEmails("nobody, ,").size).toBe(0);
  });
});

describe("isPlatformAdminUser", () => {
  const env = "karim@zealmarketing.net";
  it("needs a listed email, case-insensitively", () => {
    expect(isPlatformAdminUser({ email: "KARIM@zealmarketing.net", emailVerified: true }, env)).toBe(true);
    expect(isPlatformAdminUser({ email: "someone@else.com", emailVerified: true }, env)).toBe(false);
  });
  it("needs a verified email", () => {
    expect(isPlatformAdminUser({ email: "karim@zealmarketing.net", emailVerified: false }, env)).toBe(false);
  });
  it("denies everyone when the list is empty or there is no user", () => {
    expect(isPlatformAdminUser({ email: "karim@zealmarketing.net", emailVerified: true }, "")).toBe(false);
    expect(isPlatformAdminUser(null, env)).toBe(false);
  });
});

describe("view-as token", () => {
  const secret = "test-secret";
  const claim: ViewAsClaim = { adminUserId: "u1", workspaceId: "w1", slug: "acme", expiresAt: 2_000 };

  it("round-trips before it expires", () => {
    expect(verifyViewAs(signViewAs(claim, secret), secret, 1_000)).toEqual(claim);
  });
  it("rejects expired tokens", () => {
    expect(verifyViewAs(signViewAs(claim, secret), secret, 2_000)).toBeNull();
  });
  it("rejects a different secret or a tampered payload", () => {
    const token = signViewAs(claim, secret);
    expect(verifyViewAs(token, "other", 1_000)).toBeNull();
    const forged = Buffer.from(JSON.stringify({ ...claim, slug: "victim" })).toString("base64url");
    expect(verifyViewAs(`${forged}.${token.split(".")[1]}`, secret, 1_000)).toBeNull();
    expect(verifyViewAs("garbage", secret, 1_000)).toBeNull();
    expect(verifyViewAs(undefined, secret, 1_000)).toBeNull();
  });
});
