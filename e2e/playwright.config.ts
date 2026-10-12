import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against production builds of the dashboard (:3000) and the public
 * renderer (:3001). Requires Postgres + migrations, PAYMENTS_TEST_MODE=true and
 * ROOT_DOMAIN=localhost:3001 (Chromium resolves *.localhost to 127.0.0.1).
 * Run: pnpm build && pnpm --filter @zfunnel/e2e e2e
 */
const reuse = !process.env.CI;
// Ports can be moved (E2E_WEB_PORT / E2E_SITES_PORT) when 3000/3001 are taken; set ROOT_DOMAIN to match.
const WEB_PORT = process.env.E2E_WEB_PORT ?? "3000";
const SITES_PORT = process.env.E2E_SITES_PORT ?? "3001";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `pnpm --filter @zfunnel/web exec next start --port ${WEB_PORT}`,
      // The import test serves fixture pages from a local mock (private addresses are otherwise refused).
      env: {
        AUTH_RATE_LIMIT: "off",
        PLATFORM_ADMIN_EMAILS: "e2e-admin@example.com",
        FETCH_ALLOW_ORIGINS: "http://127.0.0.1:4013",
      },
      url: `http://localhost:${WEB_PORT}/sign-in`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      cwd: "..",
    },
    {
      command: `pnpm --filter @zfunnel/sites exec next start --port ${SITES_PORT}`,
      url: `http://localhost:${SITES_PORT}/api/tls/ask`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      cwd: "..",
      ignoreHTTPSErrors: true,
    },
  ],
});
