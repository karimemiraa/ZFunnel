import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

// playwright.config.ts starts the dashboard with PLATFORM_ADMIN_EMAILS=e2e-admin@example.com.
const ADMIN_EMAIL = "e2e-admin@example.com";
const db = process.env.DATABASE_URL;

/** Admins need a verified email, and sign-up doesn't verify yet, so the test does it in SQL. */
function psql(query: string): string {
  return execFileSync("psql", [db!, "-v", "ON_ERROR_STOP=1", "-tAc", query], { encoding: "utf8" });
}

test("non-admins get a 404 at /admin", async ({ page }) => {
  await signUpWithWorkspace(page, { workspace: `NoAdmin ${unique()}` });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Platform admin" })).toHaveCount(0);
});

test("platform admin: overview, view as (read-only), suspend and audit log", async ({ page, browser }) => {
  test.skip(!db, "needs DATABASE_URL and psql to verify the admin's email");

  const business = `Acme ${unique()}`;
  const ws = await signUpWithWorkspace(page, { workspace: `Cust ${unique()}`, business });

  // Fresh admin account each run (the email is fixed by the server's env).
  psql(`delete from "user" where email = '${ADMIN_EMAIL}'`);
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/sign-up");
  await admin.getByLabel("Full name").fill("Platform Admin");
  await admin.getByLabel("Email").fill(ADMIN_EMAIL);
  await admin.getByLabel("Password").fill("correct-horse-battery");
  await admin.getByRole("button", { name: "Create account" }).click();
  await admin.waitForURL(/onboarding/);

  // Unverified: still a 404.
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Page not found" })).toBeVisible();

  psql(`update "user" set email_verified = true where email = '${ADMIN_EMAIL}'`);
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(admin.getByText("Sign-ups, last 30 days").first()).toBeVisible();

  await admin.getByRole("link", { name: "Organizations" }).click();
  await admin.getByPlaceholder("Search by name or slug").fill(business);
  await admin.getByRole("link", { name: business }).click();
  await expect(admin.getByRole("heading", { name: business })).toBeVisible();

  // Read-only view as: banner, then exit back to the organization.
  await admin.getByRole("button", { name: "View as (read-only)" }).click();
  await admin.waitForURL(new RegExp(`/${ws}$`));
  await expect(admin.getByText(/as a platform admin\. Read-only/)).toBeVisible();
  // Mutations are refused server-side: trying to create a funnel saves nothing.
  await admin.goto(`/${ws}/funnels`);
  await expect(admin.getByText(/as a platform admin\. Read-only/)).toBeVisible();
  await admin
    .getByRole("button", { name: /New funnel|Create funnel/ })
    .first()
    .click();
  await admin.getByLabel("Funnel name").fill("Should not exist");
  await admin.getByRole("button", { name: /Lead magnet/ }).click();
  await admin.getByRole("button", { name: "Create funnel" }).last().click();
  await admin.waitForTimeout(1_500);
  expect(admin.url()).not.toMatch(/funnels\/[0-9a-f-]{36}/);
  expect(
    psql(`select count(*) from funnels f join workspaces w on w.id = f.workspace_id where w.slug = '${ws}'`).trim(),
  ).toBe("0");
  await admin.goto(`/${ws}`);
  await admin.getByRole("button", { name: "Exit view as" }).click();
  await admin.waitForURL(/\/admin\/organizations\//);

  // Suspend: the customer sees the suspended screen and the public site is unavailable.
  await admin.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Lift suspension" })).toBeVisible();
  await page.goto(`/${ws}`);
  await expect(page.getByRole("heading", { name: "This account is suspended" })).toBeVisible();
  const visitor = await (await browser.newContext()).newPage();
  await expect(async () => {
    await visitor.goto(siteUrl(ws));
    await expect(visitor.getByRole("heading", { name: "This site is unavailable" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  await admin.getByRole("button", { name: "Lift suspension" }).click();
  await expect(admin.getByRole("button", { name: "Suspend", exact: true })).toBeVisible();
  await page.goto(`/${ws}`);
  await expect(page.getByRole("heading", { name: "This account is suspended" })).toHaveCount(0);

  await admin.goto("/admin/audit");
  for (const action of ["Started viewing as", "Stopped viewing as", "Suspended an organization", "Lifted a suspension"])
    await expect(admin.getByText(action).first()).toBeVisible();
});
