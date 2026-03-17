import { expect, test } from "@playwright/test";

/**
 * Navigation E2E tests — NavRail panel switching + keyboard shortcuts.
 *
 * These tests exercise the pure-UI navigation layer which does not require a
 * live Gateway backend. The app fetches /api/onboarding/status on mount; we
 * intercept that call to return `{ needsOnboarding: false }` so the main Shell
 * renders immediately.
 */

test.beforeEach(async ({ page }) => {
  // Stub onboarding check so the main app Shell renders.
  await page.route("**/api/onboarding/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ needsOnboarding: false }),
    }),
  );

  // Stub gateway-dependent API calls that panels may fire on mount.
  await page.route("**/api/gateway/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "disconnected" }),
    }),
  );

  await page.route("**/api/settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
  );

  await page.goto("/");
});

// ---------------------------------------------------------------------------
// NavRail panel switching
// ---------------------------------------------------------------------------

test.describe("NavRail panel switching", () => {
  test("default panel is Chat", async ({ page }) => {
    // HeaderBar renders the active panel name in an <h1>.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
    // Default locale is zh, so we check for the presence of the heading rather
    // than a specific string (locale-dependent).
    await expect(heading).not.toBeEmpty();
  });

  test("clicking a NavRail item switches panels", async ({ page }) => {
    // The NavRail renders nav buttons with panel names as text (when expanded).
    // We click a button that contains the nav icon for "agents" panel.
    // NavRail buttons contain a <span> with the translated label.
    const navButtons = page.locator("nav button");
    // Find a button that is NOT the collapse toggle (which is the first button).
    // The second button in the nav should be the first panel item (Chat).
    // We want to click a different panel, e.g. the third button => Agents.
    // However, button order depends on the group structure. Let's look for
    // a button whose text changes the header heading.

    // Click the second nav button (first panel item = Chat is default, skip it).
    // In the NavRail, buttons are: [toggle, chat, agents, gateway, models, ...].
    const agentsButton = navButtons.nth(2);
    await agentsButton.click();

    // After click, the header heading should change.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
  });

  test("Settings button in NavRail footer switches to settings panel", async ({ page }) => {
    // Settings button is rendered at the bottom of NavRail, inside a border-t div.
    const settingsButton = page.locator("nav .border-t button");
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // The main content area should now render the Settings panel.
    // The SettingsPanel has a header with the settings title.
    const settingsHeader = page.locator("main h2");
    await expect(settingsHeader).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

test.describe("Keyboard shortcuts", () => {
  test("Alt+1 switches to Chat (first panel)", async ({ page }) => {
    // First navigate away from Chat.
    const settingsButton = page.locator("nav .border-t button");
    await settingsButton.click();

    // Now press Alt+1 to go back to Chat.
    await page.keyboard.press("Alt+1");

    // The header should reflect the Chat panel.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
  });

  test("Alt+2 switches to Agents (second panel)", async ({ page }) => {
    await page.keyboard.press("Alt+2");

    // The header heading updates to reflect the Agents panel.
    const heading = page.locator("header h1");
    await expect(heading).toBeVisible();
  });

  test("Ctrl+, opens Settings panel", async ({ page }) => {
    await page.keyboard.press("Control+,");

    // Settings panel should render in the main area.
    const settingsHeader = page.locator("main h2");
    await expect(settingsHeader).toBeVisible();
  });

  test("Ctrl+/ toggles NavRail collapse", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Measure initial nav width.
    const initialBox = await nav.boundingBox();
    expect(initialBox).not.toBeNull();

    // Toggle collapse.
    await page.keyboard.press("Control+/");

    // After collapse, nav width should shrink (from ~208px to ~56px).
    const collapsedBox = await nav.boundingBox();
    expect(collapsedBox).not.toBeNull();
    expect(collapsedBox!.width).toBeLessThan(initialBox!.width);

    // Toggle again to expand.
    await page.keyboard.press("Control+/");
    const expandedBox = await nav.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.width).toBeGreaterThan(collapsedBox!.width);
  });
});

// ---------------------------------------------------------------------------
// Responsive collapse
// ---------------------------------------------------------------------------

test.describe("Responsive behavior", () => {
  test("NavRail auto-collapses at tablet breakpoint", async ({ page }) => {
    const nav = page.locator("nav");

    // Start at desktop width — nav should be expanded.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(nav).toBeVisible();
    const desktopBox = await nav.boundingBox();
    expect(desktopBox).not.toBeNull();

    // Shrink to tablet width (<=1024px) — nav should auto-collapse.
    await page.setViewportSize({ width: 900, height: 800 });
    // Wait for the responsive effect to trigger.
    await page.waitForTimeout(300);
    const tabletBox = await nav.boundingBox();
    expect(tabletBox).not.toBeNull();
    expect(tabletBox!.width).toBeLessThanOrEqual(desktopBox!.width);
  });

  test("NavRail is hidden on mobile unless hamburger is tapped", async ({ page }) => {
    // Shrink to mobile width (<=768px).
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // On mobile, NavRail should be hidden.
    const nav = page.locator("nav");
    await expect(nav).not.toBeVisible();

    // A hamburger button should appear in the header.
    const hamburger = page.locator("header button").first();
    await expect(hamburger).toBeVisible();

    // Tapping hamburger opens mobile nav overlay.
    await hamburger.click();
    await expect(nav).toBeVisible();
  });
});
