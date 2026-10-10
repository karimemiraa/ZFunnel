import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("arabic site: RTL public pages, Arabic checkout and Arabic errors", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Arab ${unique()}` });
  await page.goto(`/${ws}/settings`);
  await page.getByRole("radio", { name: "العربية" }).click();
  // Second exact "Save" (the first one renames the workspace).
  await page.getByRole("button", { name: "Save", exact: true }).nth(1).click();
  await expect(page.getByText("Site language saved")).toBeVisible();

  await page.goto(`/${ws}/products`);
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill("كتاب موقّع");
  await page.getByLabel("Currency").selectOption("sar");
  await page.getByLabel("Price", { exact: true }).fill("120");
  await page.getByLabel(/Sell in my online store/).check();
  await page.getByLabel(/Physical product/).check();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("cell", { name: /120/ })).toBeVisible();

  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(siteUrl(ws, "/store"));
  await expect(buyer.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(buyer.locator("html")).toHaveAttribute("lang", "ar");
  await expect(buyer.getByRole("heading", { name: "المتجر" })).toBeVisible();
  await buyer.getByRole("link", { name: /كتاب موقّع/ }).click();
  await expect(buyer.getByText("بياناتك")).toBeVisible();
  await expect(buyer.getByText("المستحق اليوم")).toBeVisible();
  await expect(buyer.getByText("مدعوم من ZFunnel")).toBeVisible();
  await buyer.getByLabel("الاسم الكامل").fill("سارة");
  await buyer.getByLabel("البريد الإلكتروني").fill(`sara-${unique()}@example.com`);
  await buyer.getByLabel("العنوان", { exact: true }).fill("شارع الملك فهد");
  await buyer.getByLabel("المدينة").fill("الرياض");
  await buyer.getByLabel("الرمز البريدي").fill("12211");
  await buyer.getByLabel("الدولة").fill("السعودية");
  // A declined card returns an Arabic error from the server.
  await buyer.getByLabel("رقم البطاقة").fill("4000 0000 0000 0002");
  await buyer.getByLabel("تاريخ الانتهاء").fill("12/34");
  await buyer.getByLabel("رمز التحقق (CVC)").fill("123");
  await buyer.getByRole("button", { name: /أكمل طلبي|اشترِ الآن/ }).click();
  await expect(buyer.getByText("رُفضت البطاقة.")).toBeVisible();
  await buyer.getByLabel("رقم البطاقة").fill("4242 4242 4242 4242");
  await buyer.getByRole("button", { name: /أكمل طلبي|اشترِ الآن/ }).click();
  await expect(buyer.getByText("وصلتنا دفعتك، شكرًا لثقتك!")).toBeVisible();
  if (process.env.SHOTS) await buyer.screenshot({ path: `${process.env.SHOTS}/ar-store.png`, fullPage: true });

  // Customer center in Arabic.
  await buyer.goto(siteUrl(ws, "/account"));
  await expect(buyer.getByRole("heading", { name: "حسابك" })).toBeVisible();
  await expect(buyer.getByRole("button", { name: "أرسل لي رابط الدخول" })).toBeVisible();
});

test("arabic dashboard: RTL navigation, Arabic funnel templates and editor content", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Dash ${unique()}` });
  await page.goto(`/${ws}/settings`);
  await page.getByRole("radio", { name: "العربية" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).nth(1).click();
  await expect(page.getByText("Site language saved")).toBeVisible();

  // Switch the dashboard itself to Arabic from the account menu.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("link", { name: "أقماع المبيعات" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "الإعدادات" })).toBeVisible();

  // A funnel on an Arabic site is built from the Arabic template (the default choice is the quiz).
  await page.goto(`/${ws}/funnels`);
  await page
    .getByRole("button", { name: /قمع جديد|أنشئ قمعًا/ })
    .first()
    .click();
  await page.getByRole("textbox").first().fill("قمع الدليل");
  await page
    .getByRole("button", { name: /أنشئ القمع|إنشاء/ })
    .last()
    .click();
  await page.waitForURL(/funnels\/[0-9a-f-]{36}/);
  await expect(page.getByText("الاختبار").first()).toBeVisible();
  const stepId = await page.locator("a[href*='/editor/']").first().getAttribute("href");
  await page.goto(stepId!.replace("/editor/", "/preview/"));
  await expect(page.locator("[dir=rtl]").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "ما الذي يعيق نمو مشروعك؟" })).toBeVisible();
  await expect(page.getByText("التوصيات الشفهية")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/ar-preview.png`, fullPage: true });
});
