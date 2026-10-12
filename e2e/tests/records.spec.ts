import { expect, test, type Page } from "@playwright/test";
import { createFunnel, publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

async function addContact(page: Page, email: string, name: string) {
  await page.getByRole("button", { name: "Add contact" }).first().click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Email").fill(email);
  await d.getByLabel("Name").fill(name);
  await d.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function product(page: Page, name: string, price: string) {
  await page.getByRole("button", { name: "New product" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Price", { exact: true }).fill(price);
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

test("contacts: bulk tag, filter, saved view, and delete with undo", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Records ${unique()}` });
  await page.goto(`/${ws}/contacts`);
  await addContact(page, `ada-${unique()}@example.com`, "Ada");
  await addContact(page, `bob-${unique()}@example.com`, "Bob");

  // Bulk: tag one selected row, with a confirmation step.
  await page.getByRole("checkbox", { name: /^Select ada-/ }).check();
  await expect(page.getByTestId("bulk-count")).toHaveText("1 selected");
  await page.getByRole("button", { name: "Add tag" }).click();
  await page.getByRole("dialog").getByLabel("Tag").fill("vip");
  await page.getByTestId("bulk-confirm").click();
  await expect(page.getByText("Tagged 1 contact “vip”")).toBeVisible();

  // Filter by the tag, then save the view for the workspace.
  await page.getByTestId("filters-toggle").click();
  await page.getByRole("button", { name: "vip", exact: true }).click();
  await page.getByTestId("filters-apply").click();
  await expect(page).toHaveURL(/tags=vip/);
  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
  await expect(page.getByText("Bob", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save view" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("VIPs");
  await page.getByRole("dialog").getByRole("button", { name: "Save view" }).click();
  await expect(page.getByText("Saved “VIPs”")).toBeVisible();
  await page.goto(`/${ws}/contacts`);
  await expect(page.getByText("Bob", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "VIPs" }).click();
  await expect(page).toHaveURL(/tags=vip/);
  await expect(page.getByText("Bob", { exact: true })).toHaveCount(0);

  // Soft delete from the profile, then undo from the toast.
  await page.getByRole("link", { name: /Ada/ }).first().click();
  await expect(page.getByRole("heading", { name: "Ada" })).toBeVisible();
  await expect(page.getByTestId("timeline")).toContainText("Tagged “vip”");
  await page.getByRole("button", { name: "Delete contact (GDPR)" }).click();
  await expect(page.getByText("Not used anywhere else.")).toBeVisible();
  await page.getByTestId("confirm-delete").click();
  await page.waitForURL(new RegExp(`/${ws}/contacts$`));
  await expect(page.getByText("Ada", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Restored 1 item")).toBeVisible();
  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
});

test("products and orders link to each other; duplicate and delete show where a product is used", async ({
  page,
  browser,
}) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Linked ${unique()}` });
  await page.goto(`/${ws}/products`);
  await product(page, "Masterclass", "97");
  const funnelUrl = await createFunnel(page, ws, "Launch", "Product launch");
  await page.getByRole("link", { name: /^\d+ Checkout/ }).click();
  await page.getByLabel("Product", { exact: true }).selectOption({ label: "Masterclass: $97" });
  await page.getByLabel("As", { exact: true }).selectOption({ label: "Main product" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(/added$/).last()).toBeVisible();
  await publishFunnel(page, 5);

  const buyer = await (await browser.newContext()).newPage();
  await buyer.goto(siteUrl(ws, "/launch/checkout"));
  await buyer.getByLabel("Full name").fill("Grace Buyer");
  await buyer.getByLabel("Email").fill(`grace-${unique()}@example.com`);
  await buyer.getByLabel("Card number").fill("4242 4242 4242 4242");
  await buyer.getByLabel("Expiry").fill("12/34");
  await buyer.getByLabel("CVC").fill("123");
  await buyer.getByRole("button", { name: /Complete my order/ }).click();
  await buyer.waitForURL(/\/launch\/upsell$/);

  // Funnel page: per-step stats and the products it sells.
  await page.goto(funnelUrl);
  await expect(page.getByTestId("funnel-stats")).toContainText("Checkout");
  await expect(page.getByTestId("funnel-links").getByRole("link", { name: "Masterclass" })).toBeVisible();

  // Order page links to the contact, product and funnel.
  await page.goto(`/${ws}/orders`);
  await page
    .getByRole("link", { name: /^#\d+$/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /^Order #\d+$/ })).toBeVisible();
  await expect(page.getByTestId("order-contact")).toHaveText("Grace Buyer");
  await expect(page.getByTestId("order-funnel")).toHaveText("Launch");
  await page.getByTestId("order-items").getByRole("link", { name: "Masterclass" }).click();

  // Product page: "Sold in" and revenue per funnel.
  await expect(page.getByRole("heading", { name: "Masterclass" })).toBeVisible();
  await expect(page.getByTestId("sold-in")).toContainText("Launch");
  await expect(page.getByTestId("sold-in")).toContainText("Main product");
  await expect(page.getByTestId("revenue-by-funnel")).toContainText("$97");

  // Duplicate makes a separate product with the same price.
  await page.getByRole("button", { name: "Actions for Masterclass" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByRole("heading", { name: "Masterclass (copy)" })).toBeVisible();
  await expect(page.getByTestId("sold-in")).toContainText("Not on any funnel step yet");

  // Deleting the original warns where it is used, then can be undone.
  await page.goto(`/${ws}/products`);
  await page.getByRole("button", { name: "Actions for Masterclass", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByTestId("used-in")).toContainText("Main product on Launch › Checkout");
  await expect(page.getByTestId("used-in")).toContainText("1 order");
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByRole("link", { name: "Masterclass", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("link", { name: "Masterclass", exact: true })).toBeVisible();
});

test("a deleted funnel step stops being served until it is restored", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Steps ${unique()}` });
  await createFunnel(page, ws, "Guide", "Lead magnet");
  await publishFunnel(page, 2);
  const visitor = await page.context().browser()!.newContext();
  const v = await visitor.newPage();
  expect((await v.goto(siteUrl(ws, "/guide/thank-you")))?.status()).toBe(200);

  await page.getByRole("link", { name: /^\d+ Thank you/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Thank you", exact: true })).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete step" }).click({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByText("Deleted 1 item")).toBeVisible();
  // The public renderer caches pages for a few seconds.
  await expect
    .poll(async () => (await v.goto(siteUrl(ws, "/guide/thank-you")))?.status(), { timeout: 15_000 })
    .toBe(404);
});
