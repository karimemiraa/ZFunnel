import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("Today home: KPIs, needs attention, a sale in recent activity and a revenue goal", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Today ${unique()}` });

  // A brand-new workspace: onboarding checklist, empty KPIs, Stripe flagged.
  await expect(page.getByText("Getting started")).toBeVisible();
  await expect(page.getByTestId("kpi-revenue")).toContainText("$0");
  await expect(page.getByTestId("attention")).toContainText("Stripe isn't connected");
  await expect(page.getByText("New orders, leads and bookings appear here")).toBeVisible();

  // Set a monthly goal from the home page.
  const goal = page.getByTestId("goal-card");
  await goal.getByRole("button", { name: "Set a goal" }).click();
  await page.getByLabel("Goal amount").fill("5,000");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByText("Goal saved")).toBeVisible();
  await expect(goal).toContainText(/of \W?\$5,000/);
  await expect(goal.getByTestId("goal-status")).toBeVisible();
  await expect(goal).toContainText("Projected month-end");

  // Make a sale through the store.
  await page.goto(`/${ws}/products`);
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill("Coaching Call");
  await page.getByLabel("Price", { exact: true }).fill("250");
  await page.getByLabel(/Sell in my online store/).check();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("cell", { name: /\$250/ })).toBeVisible();

  const buyer = await (await browser.newContext({ locale: "en-US" })).newPage();
  await buyer.goto(siteUrl(ws, "/store"));
  await buyer.getByRole("link", { name: /Coaching Call/ }).click();
  await buyer.getByLabel("Full name").fill("Lina");
  await buyer.getByLabel("Email").fill(`lina-${unique()}@example.com`);
  await buyer.getByLabel("Card number").fill("4242 4242 4242 4242");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /\$250/ }).click();
  await expect(buyer.getByText("Payment received. Thank you!")).toBeVisible();

  await page.goto(`/${ws}`);
  await expect(page.getByTestId("kpi-revenue")).toContainText("$250");
  await expect(page.getByTestId("kpi-orders")).toContainText("1");
  await expect(page.getByTestId("kpi-leads")).toContainText("1");
  await page.getByRole("tab", { name: "Today" }).click();
  await expect(page.getByTestId("kpi-revenue")).toContainText("$250");
  await expect(page.getByTestId("recent")).toContainText("Order #");
  await expect(page.getByTestId("recent")).toContainText("Lina");
  await expect(goal).toContainText("$250");

  // The goal is listed (and editable) in Settings → General.
  await page.goto(`/${ws}/settings`);
  await expect(page.getByTestId("goal-list")).toContainText("Every month");
  await expect(page.getByTestId("goal-list")).toContainText("$5,000");

  // The checklist can be hidden.
  await page.goto(`/${ws}`);
  await page.getByRole("button", { name: "Hide checklist" }).click();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("onboarding")).toHaveCount(0);
});
