import { defineConfig, devices } from "@playwright/test";

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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
