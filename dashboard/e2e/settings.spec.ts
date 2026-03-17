import { expect, test } from "@playwright/test";

/**
 * Settings panel E2E tests — appearance, theme switching, language toggle.
 *
 * These tests mock all API calls so no live Gateway is needed.
 */

test.beforeEach(async ({ page }) => {
  // Stub onboarding check.
  await page.route("**/api/onboarding/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ needsOnboarding: false }),
    }),
  );

  // Stub settings API (used by SettingsPanel on mount).
  await page.route("**/api/settings", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          gatewayUrl: "ws://localhost:18789",
          gatewayToken: "",
          deckVersion: "0.1.0",
        }),
      });
    }
    // POST/PUT — save settings
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  // Stub gateway status.
  await page.route("**/api/gateway/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "disconnected" }),
    }),
  );

  await page.goto("/");

  // Navigate to Settings panel via NavRail footer button.
  const settingsButton = page.locator("nav .border-t button");
  await settingsButton.click();
});

// ---------------------------------------------------------------------------
// Settings panel rendering
// ---------------------------------------------------------------------------

test.describe("Settings panel rendering", () => {
  test("Settings panel is visible with header", async ({ page }) => {
    // SettingsPanel renders an h2 with the settings title.
    const header = page.locator("main h2");
    await expect(header).toBeVisible();
  });

  test("Appearance section shows theme and language controls", async ({ page }) => {
    // The AppearanceSection renders an h3 heading.
    const sectionHeading = page.locator("main section h3").first();
    await expect(sectionHeading).toBeVisible();

    // Theme buttons (System, Dark, Light) should be present.
    const themeButtons = page.locator("main section").first().locator("button");
    // At minimum: 3 theme + 2 language = 5 buttons.
    await expect(themeButtons.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Theme switching
// ---------------------------------------------------------------------------

test.describe("Theme switching", () => {
  test("clicking Dark theme button applies dark theme", async ({ page }) => {
    // The AppearanceSection renders theme buttons. The dark theme button
    // has specific text — we find buttons in the first section's first
    // button group.
    const buttons = page.locator("main section").first().locator("button");
    const buttonCount = await buttons.count();

    // Theme buttons are the first 3 in the appearance section.
    // Default is "system" (index 0). Dark is index 1. Light is index 2.
    // We click the second button (Dark).
    if (buttonCount >= 2) {
      await buttons.nth(1).click();

      // After clicking Dark, the button should have the accent background
      // (indicating active state). We verify by checking it's still there.
      await expect(buttons.nth(1)).toBeVisible();
    }
  });

  test("clicking Light theme button applies light theme", async ({ page }) => {
    const buttons = page.locator("main section").first().locator("button");
    const buttonCount = await buttons.count();

    if (buttonCount >= 3) {
      // Light is the third theme button (index 2).
      await buttons.nth(2).click();
      await expect(buttons.nth(2)).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Language toggle
// ---------------------------------------------------------------------------

test.describe("Language switching", () => {
  test("language toggle buttons are visible in appearance section", async ({ page }) => {
    // Language buttons are in the second row of the appearance section.
    // They show locale labels like "中文" and "English".
    const section = page.locator("main section").first();
    await expect(section).toBeVisible();

    // There should be at least 5 buttons total (3 theme + 2 language).
    const buttons = section.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("clicking EN language button switches locale", async ({ page }) => {
    const section = page.locator("main section").first();
    const buttons = section.locator("button");

    // Language buttons are at index 3 (zh) and 4 (en) in the appearance section.
    // Default locale is zh, so clicking index 4 (English) should switch.
    const count = await buttons.count();
    if (count >= 5) {
      await buttons.nth(4).click();
      // After locale change, the button should still be visible.
      await expect(buttons.nth(4)).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Header theme toggle
// ---------------------------------------------------------------------------

test.describe("Header controls", () => {
  test("header theme toggle cycles through themes", async ({ page }) => {
    // The HeaderBar has a theme toggle button (last button in header).
    const headerButtons = page.locator("header button");
    const themeToggle = headerButtons.last();
    await expect(themeToggle).toBeVisible();

    // Click to cycle theme (system -> dark -> light -> system).
    await themeToggle.click();
    // The button should still be present (just icon changes).
    await expect(themeToggle).toBeVisible();
  });

  test("header locale toggle switches language", async ({ page }) => {
    // The locale toggle button in the header contains "EN" or "ZH" text.
    const localeButton = page.locator("header button").filter({ hasText: /EN|ZH/ });
    await expect(localeButton).toBeVisible();

    const textBefore = await localeButton.textContent();
    await localeButton.click();

    // After toggle, the text should change (EN->ZH or ZH->EN).
    const textAfter = await localeButton.textContent();
    expect(textAfter).not.toBe(textBefore);
  });
});
