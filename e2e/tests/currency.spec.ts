import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("multi-currency: a zero-decimal JPY product, priced and sold correctly", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Yen ${unique()}` });
  await page.goto(`/${ws}/products`);
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill("Tea Set");
  await page.getByLabel("Currency").selectOption("jpy");
  // JPY has no decimals.
  await page.getByLabel("Price", { exact: true }).fill("47.50");
  await page.getByLabel(/Sell in my online store/).check();
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Enter a price of at least ¥50")).toBeVisible();
  await page.getByLabel("Price", { exact: true }).fill("4,700");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("cell", { name: /¥4,700/ })).toBeVisible();

  const buyer = await (await browser.newContext({ locale: "en-US" })).newPage();
  await buyer.goto(siteUrl(ws, "/store"));
  await buyer.getByRole("link", { name: /Tea Set/ }).click();
  await buyer.getByLabel("Full name").fill("Aiko");
  await buyer.getByLabel("Email").fill(`aiko-${unique()}@example.com`);
  await buyer.getByLabel("Card number").fill("4242 4242 4242 4242");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /¥4,700/ }).click();
  await expect(buyer.getByText("Payment received. Thank you!")).toBeVisible();

  await page.goto(`/${ws}/orders`);
  await expect(page.getByRole("cell", { name: "¥4,700" })).toBeVisible();
});
