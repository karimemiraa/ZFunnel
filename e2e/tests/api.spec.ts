import { expect, test } from "@playwright/test";
import { signUpWithWorkspace, unique } from "./helpers";

test("public API: a workspace key creates and reads contacts, and is isolated per tenant", async ({
  page,
  request,
}) => {
  const ws = await signUpWithWorkspace(page, { workspace: `Api ${unique()}` });
  await page.goto(`/${ws}/settings/developers`);
  await page.getByLabel("Key name").fill("Zapier");
  await page.getByRole("button", { name: "Create key" }).click();
  const key = (await page.locator("code", { hasText: /^zf_/ }).first().innerText()).trim();
  expect(key).toMatch(/^zf_/);
  const auth = { authorization: `Bearer ${key}` };

  expect((await request.get("/api/v1/me")).status()).toBe(401);
  const me = await request.get("/api/v1/me", { headers: auth });
  expect(me.ok()).toBe(true);

  const email = `api-${unique()}@example.com`;
  const created = await request.post("/api/v1/contacts", {
    headers: auth,
    data: { email, name: "Api Person", tags: ["from-api"], fields: { plan: "gold" } },
  });
  expect(created.status()).toBe(201);
  const again = await request.post("/api/v1/contacts", { headers: auth, data: { email, tags: ["second"] } });
  expect(again.status()).toBe(200);
  const body = (await again.json()) as { data: { tags: string[]; name: string } };
  expect(body.data.tags.sort()).toEqual(["from-api", "second"]);
  expect(body.data.name).toBe("Api Person");

  const list = (await (await request.get(`/api/v1/contacts?email=${email}`, { headers: auth })).json()) as {
    data: unknown[];
  };
  expect(list.data).toHaveLength(1);
  expect((await request.post("/api/v1/contacts", { headers: auth, data: { email: "nope" } })).status()).toBe(422);

  // Another tenant's key can't see this contact.
  const other = await (await page.context().browser()!.newContext()).newPage();
  const ws2 = await signUpWithWorkspace(other, { workspace: `Other ${unique()}` });
  await other.goto(`/${ws2}/settings/developers`);
  await other.getByLabel("Key name").fill("Other");
  await other.getByRole("button", { name: "Create key" }).click();
  const key2 = (await other.locator("code", { hasText: /^zf_/ }).first().innerText()).trim();
  const leak = (await (
    await request.get(`/api/v1/contacts?email=${email}`, { headers: { authorization: `Bearer ${key2}` } })
  ).json()) as { data: unknown[] };
  expect(leak.data).toHaveLength(0);

  // Revoked keys stop working.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Key revoked")).toBeVisible();
  expect((await request.get("/api/v1/me", { headers: auth })).status()).toBe(401);
});
