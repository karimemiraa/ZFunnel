/// <reference lib="dom" />
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { createFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

// Phase 8: funnel health check (8.5b), UTM link + QR code (8.5e), AI writer (8.5j), Arabic fonts (8.4).

const ADMIN_EMAIL = "e2e-admin@example.com";
const db = process.env.DATABASE_URL;
const psql = (query: string) =>
  execFileSync("psql", [db!, "-v", "ON_ERROR_STOP=1", "-tAc", query], { encoding: "utf8" });

async function setSiteArabic(page: Page, ws: string) {
  await page.goto(`/${ws}/settings`);
  await page.getByRole("radio", { name: "العربية" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).nth(1).click();
  await expect(page.getByText("Site language saved")).toBeVisible();
}

test("funnel health: scores the funnel and applies one-click fixes", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Health ${unique()}` });
  const url = await createFunnel(page, ws, "Health Guide", "Lead magnet");
  await page.goto(`${url}?view=health`);
  const panel = page.getByTestId("health-panel");
  await expect(panel).toBeVisible();
  const before = Number(await page.getByTestId("health-score").textContent());
  expect(before).toBeLessThan(100);
  await expect(panel.locator('[data-rule="unpublished"]').first()).toBeVisible();
  await expect(panel.locator('[data-rule="noDomain"]')).toBeVisible();

  // SEO filled from the page's own heading and text.
  const seo = panel.locator('[data-rule="seoTitle"]').first();
  if (await seo.getByRole("button", { name: "Fill from page" }).count()) {
    await seo.getByRole("button", { name: "Fill from page" }).click();
    await expect(page.getByText("Fixed").first()).toBeVisible();
    await expect(panel.locator('[data-rule="seoTitle"]')).toHaveCount(0);
  }

  // Publish every step from the health panel.
  while (await panel.locator('[data-rule="unpublished"]').count()) {
    const n = await panel.locator('[data-rule="unpublished"]').count();
    await panel.locator('[data-rule="unpublished"]').first().getByRole("button", { name: "Publish" }).click();
    await expect(panel.locator('[data-rule="unpublished"]')).toHaveCount(n - 1);
  }
  const after = Number(await page.getByTestId("health-score").textContent());
  expect(after).toBeGreaterThan(before);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/health.png`, fullPage: true });
});

test("UTM link builder and QR code from the step menu", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Utm ${unique()}` });
  await createFunnel(page, ws, "Utm Guide", "Lead magnet");
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "UTM link & QR code" }).click();
  await page.getByLabel("Source").fill("Facebook");
  await page.getByLabel("Medium").fill("paid social");
  await page.getByLabel("Campaign").fill("Spring Sale");
  await expect(page.getByTestId("utm-url")).toHaveValue(
    /utm-guide\/.+\?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_sale$/,
  );
  await expect(page.getByTestId("utm-qr").locator("img")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG" }).click();
  expect((await download).suggestedFilename()).toMatch(/^qr-.+-facebook-spring_sale\.svg$/);
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG" }).click();
  expect((await png).suggestedFilename()).toMatch(/\.png$/);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/utm-qr.png` });
});

test("AI writer is hidden from non-admins", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `NoWriter ${unique()}` });
  await createFunnel(page, ws, "Writer Guide", "Lead magnet");
  await page.locator("a[href*='/editor/']").first().click();
  await page.waitForURL(/\/editor\//);
  await page.frameLocator("iframe").first().locator("h1").first().click();
  await expect(page.getByText("Heading", { exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-ai-field]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI writer" })).toHaveCount(0);
});

/** Needs the dashboard started with ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL pointing at an AI mock. */
test("AI writer: a platform admin rewrites a heading, in Arabic on an Arabic site", async ({ page }) => {
  test.skip(!process.env.AI_MOCK || !db, "needs AI_MOCK and DATABASE_URL (psql) to verify the admin");
  psql(`delete from "user" where email = '${ADMIN_EMAIL}'`);
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill("Platform Admin");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/onboarding/);
  psql(`update "user" set email_verified = true where email = '${ADMIN_EMAIL}'`);
  await page.getByLabel("Business name").fill("Admin Co");
  await page.getByLabel("Workspace name").fill(`Writer ${unique()}`);
  const ws = await page.getByLabel("Free subdomain").inputValue();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(new RegExp(`/${ws}$`));
  await setSiteArabic(page, ws);
  await createFunnel(page, ws, "Writer", "Lead magnet");
  await page.locator("a[href*='/editor/']").first().click();
  await page.waitForURL(/\/editor\//);
  await page.frameLocator("iframe").first().locator("h1").first().click();
  const field = page.locator('[data-ai-field="text"]:visible').first();
  await expect(field).toBeVisible();
  await field.getByRole("button", { name: "AI writer" }).click();
  await page.getByRole("menuitem", { name: "Make it more persuasive" }).click();
  await expect(page.getByText("عنوان أقوى كتبه الذكاء الاصطناعي")).toBeVisible();
  await page.getByRole("button", { name: "Use this" }).click();
  await expect(page.frameLocator("iframe").first().getByText("عنوان أقوى كتبه الذكاء الاصطناعي")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/ai-writer.png` });
});

test("Arabic fonts: template pairing on the published page and Plex in the Arabic dashboard", async ({
  page,
  browser,
}) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Fonts ${unique()}` });
  await setSiteArabic(page, ws);
  // The default template on an Arabic site is the quiz: Cairo headings, Tajawal body text.
  await page.goto(`/${ws}/funnels`);
  await page
    .getByRole("button", { name: /New funnel|Create funnel/ })
    .first()
    .click();
  await page.getByLabel("Funnel name").fill("خطوط");
  await page.getByRole("button", { name: "Create funnel" }).last().click();
  await page.waitForURL(/funnels\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Publish funnel" }).click();
  await expect(page.getByText(/Published \d+ steps/)).toBeVisible();
  await page.reload();
  const live = await page.locator(`a[target=_blank][href*=".localhost:"]`).first().getAttribute("href");
  const path = new URL(live!).pathname;

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, path));
  const h1 = visitor.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  await visitor.evaluate(() => document.fonts.ready);
  expect(await h1.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Cairo Variable"?/);
  const loaded = await visitor.evaluate(async () => {
    await document.fonts.load('700 32px "Cairo Variable"', "ما");
    await document.fonts.load('400 16px "Tajawal"', "ما");
    return {
      cairo: document.fonts.check('700 32px "Cairo Variable"', "ما"),
      tajawal: document.fonts.check('400 16px "Tajawal"', "ما"),
      faces: Array.from(document.fonts as unknown as Iterable<FontFace>)
        .filter((f) => f.status === "loaded")
        .map((f) => f.family),
    };
  });
  expect(loaded.cairo).toBe(true);
  expect(loaded.tajawal).toBe(true);
  // Unused families are registered but never downloaded.
  expect(loaded.faces.some((f) => /Amiri|El Messiri/.test(f))).toBe(false);
  if (process.env.SHOTS) await visitor.screenshot({ path: `${process.env.SHOTS}/ar-fonts-site.png`, fullPage: true });

  // The editor's font picker previews every font in Arabic on an Arabic site.
  await page.locator("a[href*='/editor/']").first().click();
  await page.waitForURL(/\/editor\//);
  const picker = page.getByRole("radiogroup", { name: "Arabic heading font" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("radio", { name: /Amiri/ })).toContainText("خطٌّ جميل");
  await expect(
    page.getByRole("radiogroup", { name: "Heading font", exact: true }).getByRole("radio", { checked: true }),
  ).toContainText("خطٌّ جميل");
  if (process.env.SHOTS) {
    await picker.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.SHOTS}/ar-font-picker.png` });
  }
  await page.goBack();

  // Arabic dashboard UI: IBM Plex Sans Arabic.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  expect(await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
    "IBM Plex Sans Arabic",
  );
  const plex = await page.evaluate(async () => {
    await document.fonts.load('400 16px "IBM Plex Sans Arabic"', "قمع");
    return document.fonts.check('400 16px "IBM Plex Sans Arabic"', "قمع");
  });
  expect(plex).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/ar-fonts-dashboard.png` });
});
