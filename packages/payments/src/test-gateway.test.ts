import { describe, expect, it } from "vitest";
import { chargeTestCard } from "./test-gateway";

describe("test gateway", () => {
  it("accepts the success card", () => {
    expect(chargeTestCard("4242 4242 4242 4242", "12/40", "123")).toMatchObject({ ok: true, last4: "4242" });
  });
  it("declines, rejects expired and malformed cards", () => {
    expect(chargeTestCard("4000 0000 0000 0002", "12/40", "123")).toMatchObject({
      ok: false,
      message: "Your card was declined.",
    });
    expect(chargeTestCard("4242424242424242", "01/20", "123")).toMatchObject({ ok: false });
    expect(chargeTestCard("4242424242424242", "13/40", "123")).toMatchObject({ ok: false });
    expect(chargeTestCard("4242424242424242", "12/40", "x")).toMatchObject({ ok: false });
    expect(chargeTestCard("5555555555554444", "12/40", "123")).toMatchObject({ ok: false });
  });
});
