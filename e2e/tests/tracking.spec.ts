import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

/**
 * Needs a recording mock of the three ad APIs and a worker pointed at it:
 *   META_GRAPH_BASE=http://127.0.0.1:4012/meta TIKTOK_API_BASE=http://127.0.0.1:4012/tiktok
 *   GA4_MP_BASE=http://127.0.0.1:4012/ga4, and ADS_LOG=<file the mock appends JSON lines to>.
 * Runs only when ADS_LOG is set.
 */
test("tracking: a purchase reaches Meta, TikTok and GA4 server-side", async ({ page, browser }) => {
  test.skip(!process.env.ADS_LOG, "ADS_LOG not set (needs the ad API mock)");
  const ws = await signUpWithWorkspace(page, { workspace: `Ads ${unique()}` });
  await page.goto(`/${ws}/settings/tracking`);
  await page.getByLabel("Pixel (dataset) ID").fill("123456789012345");
  await page.locator("#meta-token").fill("META_TOKEN_X");
  await page.locator("#meta-test").fill("TEST42");
  await page.locator("form").nth(0).getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Meta connected")).toBeVisible();
  await page.getByLabel("Pixel code").fill("CABCDEFG1234567890");
  await page.locator("#tiktok-token").fill("TT_TOKEN_X");
  await page.locator("form").nth(1).getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("TikTok connected")).toBeVisible();
  await page.getByLabel("Measurement ID").fill("G-ABC123XYZ");
  await page.locator("#ga4-token").fill("GA_SECRET_X");
  await page.locator("form").nth(2).getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Google Analytics 4 connected")).toBeVisible();
  await expect(page.getByText("Connected")).toHaveCount(3);

  await page.goto(`/${ws}/products`);
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill("Ebook");
  await page.getByLabel("Price", { exact: true }).fill("47.50");
  await page.getByLabel(/Sell in my online store/).check();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("cell", { name: /47\.50/ })).toBeVisible();

  const email = `buyer-${unique()}@example.com`;
  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(siteUrl(ws, "/store?fbclid=IwAR0abcdefghijk&ttclid=E.C.P.xyz1234567"));
  await buyer.getByRole("link", { name: /Ebook/ }).click();
  await buyer.getByLabel("Full name").fill("Bo");
  await buyer.getByLabel("Email").fill(email);
  await buyer.getByLabel("Card number").fill("4242 4242 4242 4242");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /Buy now/ }).click();
  await expect(buyer.getByText("Payment received. Thank you!")).toBeVisible();

  const hashed = createHash("sha256").update(email).digest("hex");
  await expect(async () => {
    const lines = readFileSync(process.env.ADS_LOG!, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const mine = lines.filter((l) => JSON.stringify(l).includes(hashed) || JSON.stringify(l).includes("G-ABC123XYZ"));
    const meta = mine.find((l) => l.path.startsWith("/meta/123456789012345/events?access_token=META_TOKEN_X"));
    const tt = mine.find((l) => l.path === "/tiktok/event/track/" && l.token === "TT_TOKEN_X");
    const ga = mine.find(
      (l) => l.path.includes("measurement_id=G-ABC123XYZ") && l.path.includes("api_secret=GA_SECRET_X"),
    );
    expect(meta?.body.data[0].custom_data).toMatchObject({ currency: "USD", value: 47.5 });
    expect(meta?.body.test_event_code).toBe("TEST42");
    expect(meta?.body.data[0].user_data.fbc).toMatch(/^fb\.1\.\d+\.IwAR0abcdefghijk$/);
    expect(tt?.body.data[0]).toMatchObject({ event: "CompletePayment", user: { ttclid: "E.C.P.xyz1234567" } });
    expect(ga?.body.events[0]).toMatchObject({ name: "purchase", params: { value: 47.5 } });
    expect(JSON.stringify(mine)).not.toContain(email);
  }).toPass({ timeout: 20_000 });

  await page.goto(`/${ws}/settings/tracking`);
  await expect(page.getByText("Sent", { exact: true })).toHaveCount(3);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/tracking.png`, fullPage: true });
});
