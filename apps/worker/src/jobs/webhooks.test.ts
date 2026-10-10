import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signPayload } from "./webhooks";

describe("signPayload", () => {
  it("signs timestamp + body so receivers can verify and reject replays", () => {
    const sig = signPayload("whsec_test", '{"a":1}', 1700000000);
    const expected = createHmac("sha256", "whsec_test").update('1700000000.{"a":1}').digest("hex");
    expect(sig).toBe(`t=1700000000,v1=${expected}`);
  });
});
