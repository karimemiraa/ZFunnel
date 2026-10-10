import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("inbox: a visitor chats from the site and the owner replies", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Chat ${unique()}` });
  await page.goto(`/${ws}/inbox`);
  await page.getByRole("button", { name: /Chat widget/ }).click();
  await page.getByLabel("Show the chat bubble on my site").check();
  await page.getByLabel("Greeting").fill("Hey! Ask us anything.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Chat is live on your site")).toBeVisible();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, "/store"));
  await visitor.getByRole("button", { name: "Open chat" }).click();
  await expect(visitor.getByText("Hey! Ask us anything.")).toBeVisible();
  await visitor.getByLabel("Your name").fill("Nora");
  await visitor.getByLabel("Your email").fill(`nora-${unique()}@example.com`);
  await visitor.getByLabel("Message").fill("Do you ship to Canada?");
  await visitor.getByRole("button", { name: "Send" }).click();
  await expect(visitor.getByText("Do you ship to Canada?")).toBeVisible();
  await expect(visitor.getByLabel("Your email")).toBeHidden();

  await page.goto(`/${ws}/inbox`);
  await page.getByRole("link", { name: /Nora/ }).click();
  await expect(page.getByText("Do you ship to Canada?").first()).toBeVisible();
  await page.getByLabel("Reply").fill("Yes, worldwide!");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Reply sent")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/inbox.png`, fullPage: true });

  await visitor.reload();
  await visitor.getByRole("button", { name: "Open chat" }).click();
  await expect(visitor.getByText("Yes, worldwide!")).toBeVisible();
  if (process.env.SHOTS) await visitor.screenshot({ path: `${process.env.SHOTS}/chat-widget.png` });
});
