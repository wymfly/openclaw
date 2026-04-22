import { expect, test } from "@playwright/test";

/**
 * Onboarding wizard E2E tests.
 *
 * The onboarding flow requires a live Gateway to test connection, configure
 * providers, and send test messages. Tests that hit the real Gateway are
 * marked with `test.skip` and a comment explaining the dependency.
 *
 * Tests that only exercise the wizard UI (step navigation, field rendering)
 * can run against mocked API responses.
 */

// ---------------------------------------------------------------------------
// UI-only tests (no live Gateway needed)
// ---------------------------------------------------------------------------

test.describe("Onboarding wizard UI", () => {
  test.beforeEach(async ({ page }) => {
    // Return needsOnboarding: true so the wizard renders.
    await page.route("**/api/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needsOnboarding: true }),
      }),
    );

    await page.goto("/");
  });

  test("wizard is displayed when onboarding is needed", async ({ page }) => {
    // OnboardingWizard renders a title heading.
    const title = page.locator("h1");
    await expect(title).toBeVisible();
  });

  test("step indicator shows 3 steps", async ({ page }) => {
    // Step indicator renders round step circles.
    const stepCircles = page.locator(".rounded-full");
    await expect(stepCircles.first()).toBeVisible();

    const count = await stepCircles.count();
    expect(count).toBe(3);
  });

  test("Step 1 renders Gateway URL and Token inputs", async ({ page }) => {
    // StepConnection renders two inputs: URL (type=url) and token (type=password).
    const urlInput = page.locator('input[type="url"]');
    await expect(urlInput).toBeVisible();
    await expect(urlInput).toHaveValue("ws://localhost:18789");

    const tokenInput = page.locator('input[type="password"]');
    await expect(tokenInput).toBeVisible();
  });

  test("Test Connection button is disabled without token", async ({ page }) => {
    // The token field is empty by default, so the Test Connection button should be disabled.
    const testButton = page.locator("button").filter({ hasText: /test/i });
    await expect(testButton).toBeVisible();
    await expect(testButton).toBeDisabled();
  });

  test("Next button is disabled before successful connection test", async ({ page }) => {
    // The Next button should be disabled until a successful test result.
    const nextButton = page.locator("button").filter({ hasText: /next/i });
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });

  test("filling token enables Test Connection button", async ({ page }) => {
    const tokenInput = page.locator('input[type="password"]');
    await tokenInput.fill("test-token-123");

    const testButton = page.locator("button").filter({ hasText: /test/i });
    await expect(testButton).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Connection test with mocked API
// ---------------------------------------------------------------------------

test.describe("Onboarding connection test (mocked)", () => {
  test("successful connection test enables Next button", async ({ page }) => {
    await page.route("**/api/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needsOnboarding: true }),
      }),
    );

    // Mock the test-connection endpoint to return success.
    await page.route("**/api/onboarding/test-connection", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto("/");

    // Fill in token.
    const tokenInput = page.locator('input[type="password"]');
    await tokenInput.fill("test-token-123");

    // Click Test Connection.
    const testButton = page.locator("button").filter({ hasText: /test/i });
    await testButton.click();

    // Wait for success result to render.
    await page.waitForTimeout(500);

    // Now Next button should be enabled.
    const nextButton = page.locator("button").filter({ hasText: /next/i });
    await expect(nextButton).toBeEnabled();
  });

  test("failed connection test shows error message", async ({ page }) => {
    await page.route("**/api/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needsOnboarding: true }),
      }),
    );

    // Mock connection failure.
    await page.route("**/api/onboarding/test-connection", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "ECONNREFUSED" }),
      }),
    );

    await page.goto("/");

    const tokenInput = page.locator('input[type="password"]');
    await tokenInput.fill("bad-token");

    const testButton = page.locator("button").filter({ hasText: /test/i });
    await testButton.click();

    // Error message should appear.
    await page.waitForTimeout(500);
    const errorMsg = page.locator("text=ECONNREFUSED");
    await expect(errorMsg).toBeVisible();

    // Next button should still be disabled.
    const nextButton = page.locator("button").filter({ hasText: /next/i });
    await expect(nextButton).toBeDisabled();
  });

  test("clicking Next advances to Step 2 (Provider)", async ({ page }) => {
    await page.route("**/api/onboarding/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ needsOnboarding: true }),
      }),
    );

    await page.route("**/api/onboarding/test-connection", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      }),
    );

    await page.goto("/");

    // Fill token and test.
    const tokenInput = page.locator('input[type="password"]');
    await tokenInput.fill("test-token");

    const testButton = page.locator("button").filter({ hasText: /test/i });
    await testButton.click();
    await page.waitForTimeout(500);

    // Click Next.
    const nextButton = page.locator("button").filter({ hasText: /next/i });
    await nextButton.click();

    // Step 2 should render. StepProvider has a "Back" button.
    const backButton = page.locator("button").filter({ hasText: /back/i });
    await expect(backButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Full onboarding flow (requires live Gateway — SKIPPED)
// ---------------------------------------------------------------------------

test.describe("Full onboarding flow", () => {
  // These tests require a live Gateway instance to:
  // 1. Actually test WebSocket connection
  // 2. Save provider configuration via the Gateway API
  // 3. Send a test chat message and receive a response
  //
  // They should be run as part of integration/staging test suites with a
  // real Gateway running at ws://localhost:18789.

  test.skip("full wizard: connect -> configure provider -> send test message -> finish", async ({
    page,
  }) => {
    await page.goto("/");

    // Step 1: Enter Gateway URL and token, test connection.
    const urlInput = page.locator('input[type="url"]');
    await urlInput.fill("ws://localhost:18789");

    const tokenInput = page.locator('input[type="password"]');
    await tokenInput.fill("real-gateway-token");

    const testButton = page.locator("button").filter({ hasText: /test/i });
    await testButton.click();

    // Wait for connection success.
    const nextButton = page.locator("button").filter({ hasText: /next/i });
    await expect(nextButton).toBeEnabled({ timeout: 10000 });
    await nextButton.click();

    // Step 2: Select provider and configure API key.
    // (Provider dropdown, API key input, model input).
    const skipButton = page.locator("button").filter({ hasText: /skip/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }

    // Step 3: Send test message.
    const finishButton = page.locator("button").filter({ hasText: /finish/i });
    await expect(finishButton).toBeVisible({ timeout: 5000 });
    await finishButton.click();

    // After finishing, the main Shell should load.
    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test.skip("onboarding is skipped when gateway is already configured", async ({ page }) => {
    // When /api/onboarding/status returns needsOnboarding: false,
    // the app should go straight to the main Shell.
    await page.goto("/");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible({ timeout: 10000 });
  });
});
