import { expect, test } from "@playwright/test";
import { createFunnel, publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

/** Needs the dashboard started with ANTHROPIC_API_KEY=mock-key and ANTHROPIC_BASE_URL pointing at the AI mock. */
test("conversion coach: reviews a funnel and shows ranked advice", async ({ page, browser }) => {
  test.skip(!process.env.AI_MOCK, "AI_MOCK not set (needs the Anthropic mock)");
  const ws = await signUpWithWorkspace(page, { workspace: `Coach ${unique()}` });
  const url = await createFunnel(page, ws, "Free Guide", "Lead magnet");
  await publishFunnel(page, 2);
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, "/free-guide"));
  await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible();

  const funnelId = url.split("/").pop()!;
  await page.goto(`/${ws}/analytics?funnel=${funnelId}&range=30`);
  await page.getByRole("button", { name: "Analyze my funnel" }).click();
  await expect(page.getByText("Your coach reviewed this funnel")).toBeVisible();
  await expect(page.getByText("Your opt-in page loses most visitors.")).toBeVisible();
  await expect(page.getByText("Lead with the outcome")).toBeVisible();
  // Matched case-insensitively to the real step name.
  await expect(page.getByText("Step: Free guide")).toBeVisible();
  // A step name the coach made up is dropped, never shown.
  await expect(page.getByText("Step: Nonexistent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyze again" })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/coach.png`, fullPage: true });
});
