import { expect, test, type Page } from "@playwright/test";
import { createFunnel, publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

async function product(page: Page, name: string, price: string) {
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Price", { exact: true }).fill(price);
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function attach(page: Page, step: string, label: string, role?: string) {
  await page.getByRole("link", { name: new RegExp(`^\\d+ ${step}`) }).click();
  await expect(page.getByRole("heading", { level: 2, name: step, exact: true })).toBeVisible();
  await page.getByLabel("Product", { exact: true }).selectOption({ label });
  if (role) await page.getByLabel("As", { exact: true }).selectOption({ label: role });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/added$/).last()).toBeVisible();
}

test("checkout with order bump and one-click upsell (test gateway)", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Shop ${unique()}` });
  await page.goto(`/${ws}/products`);
  await product(page, "Masterclass", "97");
  await product(page, "Templates Pack", "27");
  await product(page, "VIP Coaching", "197");

  await createFunnel(page, ws, "Launch", "Product launch");
  await attach(page, "Checkout", "Masterclass: $97", "Main product");
  await attach(page, "Checkout", "Templates Pack: $27", "Order bump");
  await attach(page, "Upsell", "VIP Coaching: $197");
  await publishFunnel(page, 5);

  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(siteUrl(ws, "/launch/checkout"));
  await buyer.getByLabel("Full name").fill("Buyer");
  await buyer.getByLabel("Email").fill(`buyer-${unique()}@example.com`);
  await buyer.getByRole("checkbox").check();
  await expect(buyer.getByText("Due today")).toBeVisible();
  await buyer.getByLabel("Card number").fill("4242 4242 4242 4242");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /Complete my order · \$124/ }).click();
  await buyer.waitForURL(/\/launch\/upsell$/);
  await buyer.getByRole("button", { name: /Yes! Add this to my order/ }).click();
  await buyer.waitForURL(/\/launch\/thank-you$/);

  await page.goto(`/${ws}/orders`);
  await expect(page.getByRole("cell", { name: "$321" })).toBeVisible();
  await expect(page.getByText("VIP Coaching")).toBeVisible();
});

test("a declined card shows an error and creates no paid order", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Decline ${unique()}` });
  await page.goto(`/${ws}/products`);
  await product(page, "Course", "49");
  await createFunnel(page, ws, "Course", "Product launch");
  await attach(page, "Checkout", "Course: $49", "Main product");
  await publishFunnel(page, 5);

  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(siteUrl(ws, "/course/checkout"));
  await buyer.getByLabel("Full name").fill("Buyer");
  await buyer.getByLabel("Email").fill(`decline-${unique()}@example.com`);
  await buyer.getByLabel("Card number").fill("4000 0000 0000 0002");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /Complete my order/ }).click();
  await expect(buyer.getByText("Your card was declined.")).toBeVisible();

  await page.goto(`/${ws}/orders?status=paid`);
  await expect(page.getByText("No matching orders")).toBeVisible();
});
