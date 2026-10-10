import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("store: buy the last unit of a physical product with a shipping address", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Shop ${unique()}` });
  await page.goto(`/${ws}/products`);
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill("Signed Book");
  await page.getByLabel("Price", { exact: true }).fill("30");
  await page.getByLabel(/Sell in my online store/).check();
  await page.getByLabel(/Physical product/).check();
  await page.getByLabel(/Stock/).fill("1");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Signed Book", { exact: true }).first()).toBeVisible();

  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(siteUrl(ws, "/store"));
  await buyer.getByRole("link", { name: /Signed Book/ }).click();
  await expect(buyer.getByText("Only 1 left")).toBeVisible();
  if (process.env.SHOTS) await buyer.screenshot({ path: `${process.env.SHOTS}/store-product.png`, fullPage: true });
  await buyer.getByLabel("Full name").fill("Sam Reader");
  await buyer.getByLabel("Email").fill(`reader-${unique()}@example.com`);
  await buyer.getByLabel("Address", { exact: true }).fill("1 Main St");
  await buyer.getByLabel("City").fill("Berlin");
  await buyer.getByLabel("Postal code").fill("10115");
  await buyer.getByLabel("Country").fill("Germany");
  await buyer.getByLabel("Card number").fill("4242 4242 4242 4242");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /Buy now|Complete my order/ }).click();
  await expect(buyer.getByText("Payment received. Thank you!")).toBeVisible();

  await buyer.reload();
  await expect(buyer.getByText("Sold out")).toBeVisible();

  await page.goto(`/${ws}/orders`);
  await expect(page.getByText("Ship to Berlin, Germany")).toBeVisible();
});
