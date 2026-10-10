import { expect, test } from "@playwright/test";
import { createFunnel, publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("build a lead funnel, publish it, and capture a lead", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Leads ${unique()}` });
  await createFunnel(page, ws, "Free Guide", "Lead magnet");
  await publishFunnel(page, 2);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, "/free-guide?utm_source=newsletter"));
  await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible();
  await visitor.getByLabel("Name").fill("Lena");
  await visitor.getByLabel("Email").fill(`lena-${unique()}@example.com`);
  await visitor.getByRole("button", { name: /Send me the free guide/ }).click();
  await visitor.waitForURL(/\/free-guide\/thank-you$/);
  await expect(visitor.getByRole("heading", { level: 1 })).toContainText("on its way");

  await page.goto(`/${ws}/contacts`);
  await expect(page.getByText("Lena", { exact: true })).toBeVisible();
  await expect(page.getByText("via newsletter")).toBeVisible();

  await page.goto(`/${ws}/analytics`);
  await expect(page.getByText("Leads", { exact: true })).toBeVisible();
});

test("a member cannot open another tenant's workspace", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Private ${unique()}` });
  const other = await (await browser.newContext()).newPage();
  await signUpWithWorkspace(other, { workspace: `Other ${unique()}` });
  const res = await other.goto(`/${ws}`);
  expect(res?.status()).toBe(404);
});
