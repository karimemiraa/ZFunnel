import { expect, test } from "@playwright/test";
import { createFunnel, publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("A/B split test: sticky assignment, per-variant stats and declaring a winner", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Split ${unique()}` });
  const funnelUrl = await createFunnel(page, ws, "Free Guide", "Lead magnet");
  await publishFunnel(page, 2);
  await page.getByRole("button", { name: "Create variant B" }).click();
  await page.waitForURL(/variant=/);
  await expect(page.getByText("VARIANT B")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Variant B is live in your split test.")).toBeVisible();

  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    const ctx = await browser.newContext({ userAgent: `Mozilla/5.0 visitor-${i} Chrome/130` });
    const v = await ctx.newPage();
    await v.goto(siteUrl(ws, "/free-guide"));
    await v.waitForTimeout(400);
    const c = (await ctx.cookies()).find((x) => x.name.startsWith("zfv_"));
    expect(c).toBeTruthy();
    seen.push(c!.value);
    await v.reload();
    await v.waitForTimeout(300);
    expect((await ctx.cookies()).find((x) => x.name.startsWith("zfv_"))!.value).toBe(c!.value);
    if (i === 0) {
      await v.getByLabel("Name").fill("Lena");
      await v.getByLabel("Email").fill(`lena-${unique()}@example.com`);
      await v.getByRole("button", { name: /Send me the free guide/ }).click();
      await v.waitForURL(/thank-you$/);
    }
    await ctx.close();
  }
  // Both versions got traffic, and the counts on the dashboard add up.
  const b = seen.filter((x) => x !== "a").length;
  await page.goto(funnelUrl);
  await expect(page.getByText("Split test running")).toBeVisible();
  const visitors = page.locator("section", { hasText: "Split test running" }).locator("tbody tr td:nth-child(2)");
  await expect(visitors.nth(0)).toHaveText(String(8 - b));
  await expect(visitors.nth(1)).toHaveText(String(b));
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Variant B wins" }).click();
  await expect(page.getByText("The variant is now your live page")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create variant B" })).toBeVisible();
});
