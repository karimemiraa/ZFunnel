import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("white-label: brand color, and removing the badge needs a Pro plan", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Brand ${unique()}` });
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, "/store"));
  await expect(visitor.getByRole("link", { name: "Powered by ZFunnel" })).toBeVisible();

  // Trial: the badge can't be removed yet.
  await page.goto(`/${ws}/settings`);
  await expect(page.getByLabel(/Remove “Powered by ZFunnel”/)).toBeDisabled();
  await page.getByLabel("Brand color", { exact: true }).fill("#0f766e");
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByText("Branding saved")).toBeVisible();

  await page.goto(`/${ws}/settings/billing`);
  await page.getByRole("button", { name: "Choose Pro" }).click();
  await page.waitForURL(/success=1/);

  await page.goto(`/${ws}/settings`);
  await expect(page.getByLabel("Brand color", { exact: true })).toHaveValue("#0f766e");
  await page.getByLabel(/Remove “Powered by ZFunnel”/).check();
  await page.getByRole("button", { name: "Save branding" }).click();
  await expect(page.getByText("Branding saved")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/branding.png`, fullPage: true });

  // The site resolver caches for a few seconds.
  await expect(async () => {
    await visitor.reload();
    await expect(visitor.getByRole("heading", { name: "Shop" })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Powered by ZFunnel" })).toHaveCount(0);
  }).toPass({ timeout: 15_000 });
});
