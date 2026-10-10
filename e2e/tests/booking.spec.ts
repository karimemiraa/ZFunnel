import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("booking calendar: a visitor books a slot, it disappears, and the owner sees it", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Calls ${unique()}` });
  await page.goto(`/${ws}/calendars`);
  await page.getByRole("button", { name: "New calendar" }).first().click();
  await page.getByLabel("Name").fill("Strategy Call");
  await page.getByRole("button", { name: "Create calendar" }).click();
  await page.waitForURL(/calendars\/[0-9a-f-]{36}/);
  // Open every day so the test never depends on today's weekday.
  for (const d of ["Saturday", "Sunday"]) await page.getByLabel(d, { exact: true }).check();
  await page.getByLabel("Minimum notice (hours)").fill("0");
  await page.getByRole("button", { name: "Save calendar" }).click();
  await expect(page.getByText("Calendar saved")).toBeVisible();

  const visitor = await (await browser.newContext({ timezoneId: "Europe/Berlin" })).newPage();
  await visitor.goto(siteUrl(ws, "/book/strategy-call"));
  await expect(visitor.getByRole("heading", { name: "Strategy Call" })).toBeVisible();
  if (process.env.SHOTS) await visitor.screenshot({ path: `${process.env.SHOTS}/booking.png` });
  const firstSlot = visitor.locator("button", { hasText: /\d{1,2}:\d{2}/ }).first();
  const label = await firstSlot.innerText();
  await firstSlot.click();
  await visitor.getByLabel("Name").fill("Nora");
  await visitor.getByLabel("Email").fill(`nora-${unique()}@example.com`);
  await visitor.getByRole("button", { name: "Confirm booking" }).click();
  await expect(visitor.getByRole("heading", { name: "You're booked!" })).toBeVisible();

  // The same slot is no longer offered.
  await visitor.goto(siteUrl(ws, "/book/strategy-call"));
  await expect(visitor.locator("button", { hasText: /\d{1,2}:\d{2}/ }).first()).not.toHaveText(label);

  await page.goto(`/${ws}/calendars`);
  await expect(page.getByRole("link", { name: "Nora" })).toBeVisible();
});
