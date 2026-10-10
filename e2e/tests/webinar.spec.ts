import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, siteUrl, unique } from "./helpers";

test("webinars: evergreen registration and a live session with an offer", async ({ page, browser }) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Web ${unique()}` });
  await page.goto(`/${ws}/webinars`);
  await page.getByRole("button", { name: "New webinar" }).first().click();
  await page.getByLabel("Title").fill("Launch Your Course");
  await page.getByRole("button", { name: "Create webinar" }).click();
  await page.waitForURL(/webinars\/[0-9a-f-]{36}/);

  // Publishing needs a video.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Add a video link before publishing.")).toBeVisible();
  await page.getByLabel("What will they learn?").fill("Pick a profitable topic\nPrice it right");
  await page.getByLabel("Video link").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByLabel("Timezone").selectOption("Africa/Abidjan"); // UTC+0, no DST
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Webinar saved")).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Registration page is live")).toBeVisible();

  // Evergreen: a "just in time" session is offered first.
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(siteUrl(ws, "/webinar/launch-your-course"));
  await expect(visitor.getByRole("heading", { name: "Launch Your Course" })).toBeVisible();
  await expect(visitor.getByText("Pick a profitable topic")).toBeVisible();
  await expect(visitor.getByText(/Starting in \d+ minutes/)).toBeVisible();
  if (process.env.SHOTS)
    await visitor.screenshot({ path: `${process.env.SHOTS}/webinar-register.png`, fullPage: true });
  await visitor.getByLabel("Your name").fill("Mia");
  await visitor.getByLabel("Your email").fill(`mia-${unique()}@example.com`);
  await visitor.getByRole("button", { name: "Register now" }).click();
  await visitor.waitForURL(/\/webinar\/watch\//);
  await expect(visitor.getByText("You're registered ✓")).toBeVisible();
  await expect(visitor.getByLabel("Time until the webinar starts")).toBeVisible();
  if (process.env.SHOTS) await visitor.screenshot({ path: `${process.env.SHOTS}/webinar-waiting.png` });

  // Switch to a live event that started 3 minutes ago, with an offer from minute 0.
  const started = new Date(Date.now() - 3 * 60_000).toISOString().slice(0, 16);
  await page.getByRole("button", { name: "One-time live" }).click();
  await page.getByLabel(/Starts at/).fill(started);
  await page.getByLabel("Button text").fill("Join the program");
  await page.getByLabel("Link", { exact: true }).fill("https://example.com/checkout");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Webinar saved")).toBeVisible();

  const late = await (await browser.newContext()).newPage();
  await late.goto(siteUrl(ws, "/webinar/launch-your-course"));
  await expect(late.getByText(/Live now \(started [34] min ago\)/)).toBeVisible();
  await late.getByLabel("Your email").fill(`leo-${unique()}@example.com`);
  await late.getByRole("button", { name: "Register now" }).click();
  await late.waitForURL(/\/webinar\/watch\//);
  await expect(late.getByText("Live", { exact: true })).toBeVisible();
  await late.getByRole("button", { name: "Join the webinar now" }).click();
  const frame = late.locator('iframe[title="Webinar"]');
  // A real live stream plays as-is (no seeking, normal controls).
  await expect(frame).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*start=0/);
  await expect(late.getByRole("link", { name: /Join the program/ })).toHaveAttribute(
    "href",
    "https://example.com/checkout",
  );

  await page.reload();
  await expect(page.getByText("Attended", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("cell", { name: "Upcoming" })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/webinar-admin.png`, fullPage: true });
});
