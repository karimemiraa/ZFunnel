import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("blog: write, publish, and it appears on the blog, sitemap and RSS", async ({ page }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Writer ${unique()}` });
  await page.goto(`/${ws}/blog`);
  await page.getByRole("button", { name: "New post" }).first().click();
  await page.waitForURL(/blog\/[0-9a-f-]{36}/);
  await page.getByLabel("Post title").fill("How to build a funnel that converts");
  await page.getByLabel("URL", { exact: true }).fill("funnel-that-converts");
  await page.getByLabel("Excerpt").fill("Seven steps from cold traffic to customers.");
  await page.getByLabel("Post content").fill("<h2>Step one</h2>\n\nKnow your audience.<script>alert(1)</script>");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published", { exact: true })).toBeVisible();

  const visitor = page.context();
  const v = await visitor.newPage();
  await v.goto(siteUrl(ws, "/blog"));
  await v.getByRole("link", { name: /How to build a funnel that converts/ }).click();
  await expect(v.getByRole("heading", { level: 2, name: "Step one" })).toBeVisible();
  expect(await v.locator("article script").count()).toBe(0);
  if (process.env.SHOTS) await v.screenshot({ path: `${process.env.SHOTS}/blog-post.png`, fullPage: true });

  const sitemap = await (await v.goto(siteUrl(ws, "/sitemap.xml")))!.text();
  expect(sitemap).toContain("/blog/funnel-that-converts");
  const rss = await (await v.goto(siteUrl(ws, "/blog/rss.xml")))!.text();
  expect(rss).toContain("How to build a funnel that converts");
});
