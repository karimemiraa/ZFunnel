/**
 * Built-in test gateway: lets people run their funnel end to end (checkout and one-click
 * upsells) before connecting Stripe. Orders are flagged as test orders and no money moves.
 * Enabled by PAYMENTS_TEST_MODE=true; never on when a live Stripe account is connected.
 */
export const TEST_CARDS = {
  success: "4242424242424242",
  declined: "4000000000000002",
  /** Simulates a bank asking for 3-D Secure on one-click upsells. */
  authRequired: "4000002500003155",
} as const;

export function testModeEnabled() {
  return process.env.PAYMENTS_TEST_MODE === "true";
}

export type TestCardResult =
  { ok: true; last4: string; brand: string; paymentMethodId: string } | { ok: false; message: string };

export function chargeTestCard(cardNumber: string, expiry: string, cvc: string): TestCardResult {
  const digits = cardNumber.replace(/\D/g, "");
  const [mm, yy] = expiry.split("/").map((s) => Number(s.trim()));
  if (!/^\d{3,4}$/.test(cvc.trim())) return { ok: false, message: "errors.cardCvcInvalid" };
  if (!mm || !yy || mm < 1 || mm > 12) return { ok: false, message: "errors.cardExpiryInvalid" };
  const year = yy < 100 ? 2000 + yy : yy;
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && mm < now.getMonth() + 1))
    return { ok: false, message: "errors.cardExpired" };
  if (digits === TEST_CARDS.declined) return { ok: false, message: "errors.cardDeclined" };
  if (digits !== TEST_CARDS.success && digits !== TEST_CARDS.authRequired)
    return { ok: false, message: "errors.testModeCard" };
  return { ok: true, last4: digits.slice(-4), brand: "visa", paymentMethodId: `test_pm_${digits.slice(-4)}` };
}
