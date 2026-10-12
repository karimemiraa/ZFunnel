import { expect, test, type Page } from "@playwright/test";
import { createFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

const sidebar = (page: Page) => page.locator("aside").getByRole("navigation", { name: "Main" });

test("nav: grouped sidebar, collapsible groups, pins, icon rail, create menu, shortcuts", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Nav ${unique()}` });
  const nav = sidebar(page);

  // Groups in the approved order, Overview first and Settings last.
  const groups = nav.getByRole("group");
  await expect(groups).toHaveCount(5);
  for (const [i, name] of ["Sell", "Marketing", "Customers", "Learn & community", "Insights"].entries())
    await expect(groups.nth(i)).toHaveAttribute("aria-label", name);
  await expect(nav.getByRole("group", { name: "Sell" }).getByRole("link")).toHaveText([
    "Funnels",
    "Products",
    "Orders",
  ]);
  const links = nav.getByRole("link");
  await expect(links.first()).toHaveText("Overview");
  await expect(links.last()).toHaveText("Settings");

  // Collapsing a group survives a reload (localStorage).
  await nav.getByRole("button", { name: "Show or hide Marketing" }).click();
  await expect(nav.getByRole("link", { name: "Email" })).toBeHidden();
  await page.reload();
  await expect(sidebar(page).getByRole("link", { name: "Email" })).toBeHidden();
  await sidebar(page).getByRole("button", { name: "Show or hide Marketing" }).click();
  await expect(sidebar(page).getByRole("link", { name: "Email" })).toBeVisible();

  // Pin a favorite.
  await sidebar(page).getByRole("link", { name: "Orders" }).hover();
  await sidebar(page).getByRole("button", { name: "Pin Orders" }).click();
  const pinned = sidebar(page).getByRole("group", { name: "Pinned" });
  await expect(pinned.getByRole("link", { name: "Orders" })).toBeVisible();
  await page.reload();
  await expect(
    sidebar(page).getByRole("group", { name: "Pinned" }).getByRole("link", { name: "Orders" }),
  ).toBeVisible();

  // Icon-only rail, remembered.
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator("aside[data-collapsed]")).toBeVisible();
  await page.reload();
  await expect(page.locator("aside[data-collapsed]")).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Funnels" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator("aside[data-collapsed]")).toHaveCount(0);

  // "+ Create" lands on the existing creation flow.
  await page.getByRole("button", { name: "Create something new" }).click();
  await page.getByRole("menuitem", { name: "Product" }).click();
  await expect(page).toHaveURL(new RegExp(`/${ws}/products`));
  await expect(page.getByRole("dialog").getByRole("heading", { name: "New product" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Breadcrumbs on a deep page.
  await page.goto(`/${ws}/funnels/import`);
  const crumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
  await expect(crumbs.getByRole("link", { name: "Funnels" })).toHaveAttribute("href", `/${ws}/funnels`);

  // Shortcuts: "?" help, "g o" jump, "c" create, and nothing fires while typing.
  await page.goto(`/${ws}/contacts`);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox").or(page.getByRole("textbox").first()).first().click();
  await page.keyboard.type("go");
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(new RegExp(`/${ws}/contacts`));
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("g");
  await page.keyboard.press("o");
  await expect(page).toHaveURL(new RegExp(`/${ws}/orders$`));
  await page.keyboard.press("c");
  await expect(page.getByRole("menuitem", { name: "Funnel" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Mobile bottom bar.
  await page.setViewportSize({ width: 390, height: 800 });
  const bottom = page.getByRole("navigation", { name: "Quick navigation" });
  await expect(bottom).toBeVisible();
  await bottom.getByRole("link", { name: "Funnels" }).click();
  await expect(page).toHaveURL(new RegExp(`/${ws}/funnels$`));
});

test("command palette: search, keyboard navigation, recents, actions and Arabic", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Palette ${unique()}` });
  const name = `Palette Funnel ${unique()}`;
  const funnelUrl = await createFunnel(page, ws, name, "Lead magnet");

  await page.goto(`/${ws}`);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  const input = palette.getByRole("combobox");
  await expect(input).toBeFocused();

  await input.fill(name.slice(0, 18));
  const hit = palette.getByRole("option", { name: new RegExp(name) });
  await expect(hit).toBeVisible();
  // Keyboard: the first option is active; Enter opens it.
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await input.press("Enter");
  await expect(page).toHaveURL(funnelUrl);

  // Recents.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette.getByRole("group", { name: "Recent" }).getByRole("option", { name })).toBeVisible();

  // Settings pages and quick actions, reached with the arrow keys.
  await input.fill("billing");
  await expect(palette.getByRole("option", { name: /Billing/ })).toBeVisible();
  await input.fill("new product");
  await expect(palette.getByRole("option", { name: "New Product" })).toBeVisible();
  await input.fill("go to");
  await input.press("ArrowDown");
  await expect(palette.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowUp");
  await input.press("ArrowUp");
  await expect(palette.getByRole("option").last()).toHaveAttribute("aria-selected", "true");
  await input.fill("zzzz-nothing");
  await expect(palette.getByText(/Nothing matches/)).toBeVisible();

  // "/" opens it too, and the language action switches the dashboard to Arabic (RTL).
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await page.keyboard.press("/");
  await input.fill("arabic");
  await input.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.keyboard.press("ControlOrMeta+k");
  const ar = page.getByRole("dialog", { name: "لوحة الأوامر" });
  await expect(ar).toBeVisible();
  await ar.getByRole("combobox").fill("Palette");
  await expect(ar.getByRole("group", { name: "أقماع المبيعات" }).getByRole("option", { name })).toBeVisible();
  await ar.getByRole("combobox").fill("English");
  await ar.getByRole("combobox").press("Enter");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("notifications: a chat message reaches the bell and the inbox badge", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Bell ${unique()}` });
  const bell = page.locator("[data-notifications-bell]");
  await expect(bell).toHaveAttribute("aria-label", "Notifications");

  await page.goto(`/${ws}/inbox`);
  await page.getByRole("button", { name: /Chat widget/ }).click();
  await page.getByLabel("Show the chat bubble on my site").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Chat is live on your site")).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, "/store"));
  await visitor.getByRole("button", { name: "Open chat" }).click();
  await visitor.getByLabel("Your name").fill("Layla");
  await visitor.getByLabel("Your email").fill(`layla-${unique()}@example.com`);
  await visitor.getByLabel("Message").fill("Is there a student discount?");
  await visitor.getByRole("button", { name: "Send" }).click();
  await expect(visitor.getByText("Is there a student discount?")).toBeVisible();

  await page.goto(`/${ws}/funnels`);
  await expect(bell).toHaveAttribute("aria-label", /1 unread notification/);
  await expect(sidebar(page).locator('[data-badge="inbox"]')).toContainText("1");

  await bell.click();
  const item = page.getByRole("link", { name: /New message from Layla/ });
  await expect(item).toBeVisible();
  await expect(page.getByText("Is there a student discount?")).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(bell).toHaveAttribute("aria-label", "Notifications");
  await expect(item).toHaveAttribute("data-read", "true");
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/${ws}/inbox\\?c=`));

  // Read state persists on the server.
  await page.reload();
  await expect(bell).toHaveAttribute("aria-label", "Notifications");
});
