import { expect, test } from "@playwright/test";
import { createFunnel, signUpWithWorkspace, unique } from "./helpers";

test("billing: trial, choosing a plan (test mode) and plan features", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Bill ${unique()}` });
  await page.goto(`/${ws}/settings/billing`);
  await expect(page.getByText("14 days left")).toBeVisible();

  await page.goto(`/${ws}/settings/billing`);
  await page.getByRole("button", { name: "Choose Starter" }).click();
  await page.waitForURL(/success=1/);
  await expect(page.getByText("Current plan")).toBeVisible();

  // Starter has no split tests.
  await createFunnel(page, ws, "Free Guide", "Lead magnet");
  await page.getByRole("button", { name: "Publish funnel" }).click();
  await expect(page.getByText(/Published 2 steps/)).toBeVisible();
  await page.getByRole("button", { name: "Create variant B" }).click();
  await expect(page.getByText(/A\/B split tests isn't included in the Starter plan/)).toBeVisible();
});
