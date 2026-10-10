import { expect, test } from "@playwright/test";
import { createFunnel, signUpWithWorkspace, unique } from "./helpers";

test("share funnel: another account previews the link and imports a full copy", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Sharer ${unique()}` });
  await createFunnel(page, ws, "Webinar Pro", "Webinar registration");
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Create share link" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  expect(link).toContain("/share/");

  const other = await (await browser.newContext()).newPage();
  const ws2 = await signUpWithWorkspace(other, { workspace: `Importer ${unique()}` });
  await other.goto(link);
  await expect(other.getByRole("heading", { name: "Webinar Pro" })).toBeVisible();
  await other.getByRole("button", { name: "Import funnel" }).click();
  await other.waitForURL(new RegExp(`/${ws2}/funnels/[0-9a-f-]{36}`));
  await expect(other.getByRole("heading", { level: 1, name: "Webinar Pro" })).toBeVisible();

  // Turning sharing off kills the link (the dialog is still open on the first page).
  await page.getByRole("button", { name: /Stop sharing/ }).click();
  await expect(page.getByRole("button", { name: "Create share link" })).toBeVisible();
  const res = await other.goto(link);
  expect(res?.status()).toBe(404);
});
