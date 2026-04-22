import { defineConfig, devices } from "@playwright/test";

const liveSmoke = process.env.PLAYWRIGHT_LIVE_SMOKE === "1";
const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Playwright E2E configuration for openclaw-deck.
 *
 * Run with: pnpm test:e2e
 *
 * The webServer block starts `pnpm dev` automatically if no server is already
 * running on port 3000. Set `reuseExistingServer: true` so that a long-running
 * dev server is picked up instead of spawning a second one.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !liveSmoke,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI || liveSmoke ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL,
    trace: liveSmoke ? "retain-on-failure" : "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          port: 3000,
          reuseExistingServer: true,
        },
      }),
});
