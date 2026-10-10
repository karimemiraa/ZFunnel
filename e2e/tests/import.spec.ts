import { expect, test } from "@playwright/test";
import http from "node:http";
import { publishFunnel, signUpWithWorkspace, siteUrl, unique } from "./helpers";

/**
 * Serves two ClickFunnels-style pages from a local mock. The dashboard refuses private addresses,
 * so it must run with FETCH_ALLOW_ORIGINS=http://127.0.0.1:4013 (set in playwright.config.ts).
 */
const PORT = 4013;
const ORIGIN = `http://127.0.0.1:${PORT}`;
// 1×1 transparent PNG (served at a larger declared size so it isn't treated as a pixel).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const OPTIN = `<!doctype html><html><head><title>Free Guide</title><script>window.x=1</script></head><body>
<div class="container" id="section-1" data-title="section" style="background-color:#111827">
  <div class="de" data-de-type="headline"><h1 class="elHeadline">Get The Imported Guide</h1></div>
  <div class="de" data-de-type="image"><img class="elImage" src="/cover.png" width="300" alt="Cover"></div>
  <div class="de" data-de-type="input"><input name="first_name" placeholder="First name"></div>
  <div class="de" data-de-type="input"><input name="email" placeholder="Email"></div>
  <div class="de" data-de-type="button"><a href="#submit-form" class="elButton"><span class="elButtonMain">Send It Now</span></a></div>
</div></body></html>`;
const THANKS = `<!doctype html><html><head><title>Thank You</title></head><body>
<div data-page-element="SectionContainer/V1"><div data-page-element="Headline/V1"><h1>Check Your Inbox</h1></div></div>
</body></html>`;

test("import ClickFunnels pages into a new funnel", async ({ page, browser }) => {
  test.skip(!process.env.CI && !process.env.FETCH_ALLOW_ORIGINS, "dashboard must run with FETCH_ALLOW_ORIGINS");
  const server = http.createServer((req, res) => {
    if (req.url === "/optin") return res.writeHead(200, { "content-type": "text/html" }).end(OPTIN);
    if (req.url === "/thanks") return res.writeHead(200, { "content-type": "text/html" }).end(THANKS);
    if (req.url === "/cover.png") return res.writeHead(200, { "content-type": "image/png" }).end(PNG);
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", r));
  try {
    const ws = await signUpWithWorkspace(page, { workspace: `Import ${unique()}` });
    await page.goto(`/${ws}/funnels`);
    await page.getByRole("link", { name: "Import from ClickFunnels" }).click();
    await page.getByLabel("New funnel name").fill("Imported Guide");
    await page.getByLabel(/Page links/).fill(`${ORIGIN}/optin\n${ORIGIN}/thanks`);
    await page.getByLabel("I own these pages or have the right to import them").check();
    await page.getByRole("button", { name: "Import funnel" }).click();
    await expect(page.getByText("Your funnel is ready")).toBeVisible();
    await expect(page.getByText("2 pages imported", { exact: false })).toBeVisible();
    await expect(page.getByText("1 image copied to your storage.")).toBeVisible();
    await page.getByRole("link", { name: "Open funnel" }).click();
    await page.waitForURL(/funnels\/[0-9a-f-]{36}/);
    await expect(page.getByText("Free Guide").first()).toBeVisible();
    await expect(page.getByText("Thank You").first()).toBeVisible();
    await publishFunnel(page, 2);

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(siteUrl(ws, "/imported-guide"));
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Get The Imported Guide");
    await expect(visitor.getByRole("button", { name: "Send It Now" })).toBeVisible();
    const src = await visitor.getByAltText("Cover").getAttribute("src");
    expect(src).toMatch(/\/api\/media\/[0-9a-f-]{36}$/);
    // The browser loads the re-hosted copy from the public site (*.localhost resolves only in Chromium).
    await expect
      .poll(() =>
        visitor.getByAltText("Cover").evaluate((el) => {
          const img = el as unknown as { complete: boolean; naturalWidth: number }; // e2e tsconfig has no DOM lib
          return img.complete && img.naturalWidth;
        }),
      )
      .toBe(1);
  } finally {
    server.close();
  }
});
