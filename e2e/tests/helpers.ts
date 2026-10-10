import { expect, type Page } from "@playwright/test";

export const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export async function signUpWithWorkspace(page: Page, opts: { name?: string; workspace: string }) {
  const id = unique();
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(opts.name ?? "Test Owner");
  await page.getByLabel("Email").fill(`owner-${id}@example.com`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/onboarding/);
  await page.getByLabel("Business name").fill("E2E Inc");
  await page.getByLabel("Workspace name").fill(opts.workspace);
  const slug = await page.getByLabel("Free subdomain").inputValue();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(new RegExp(`/${slug}$`));
  return slug;
}

export async function createFunnel(page: Page, ws: string, name: string, template: string) {
  await page.goto(`/${ws}/funnels`);
  await page
    .getByRole("button", { name: /New funnel|Create funnel/ })
    .first()
    .click();
  await page.getByLabel("Funnel name").fill(name);
  await page.getByRole("button", { name: new RegExp(template) }).click();
  await page.getByRole("button", { name: "Create funnel" }).last().click();
  await page.waitForURL(/funnels\/[0-9a-f-]{36}/);
  return page.url().split("?")[0]!;
}

export async function publishFunnel(page: Page, steps: number) {
  await page.getByRole("button", { name: "Publish funnel" }).click();
  await expect(page.getByText(`Published ${steps} steps`)).toBeVisible();
}

export const siteUrl = (ws: string, path = "") => `http://${ws}.localhost:3001${path}`;
