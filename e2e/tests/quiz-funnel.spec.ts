import { expect, test } from "@playwright/test";
import { createFunnel, publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("a quiz scores answers on the server, tags the lead and reports results", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Quiz ${unique()}` });
  await createFunnel(page, ws, "Growth Quiz", "Quiz funnel");
  await publishFunnel(page, 2);
  const v = await (await browser.newContext()).newPage();
  await v.goto(siteUrl(ws, "/growth-quiz"));
  await v.getByRole("radio", { name: /A sales funnel/ }).click();
  await v.getByRole("radio", { name: /50–200/ }).click();
  await v.getByRole("radio", { name: /Converting visitors/ }).click();
  await v.getByLabel("Name").fill("Omar");
  await v.getByLabel("Email").fill(`omar-${unique()}@example.com`);
  await v.getByRole("button", { name: /Show my result/ }).click();
  await v.waitForURL(/your-plan$/);

  await page.goto(`/${ws}/forms`);
  await page.getByRole("link", { name: "Growth quiz" }).click();
  await expect(page.getByText("The Scale Seeker").first()).toBeVisible();
  await page.getByRole("link", { name: "responses" }).click();
  await page.getByRole("link", { name: "Omar" }).click();
  await expect(page.getByText("result-scale")).toBeVisible();
});
