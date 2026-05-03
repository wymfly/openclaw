import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { authHeaders, openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("alerts mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders alert policy workbench and contract-shaped mutation state", async ({
    page,
    request,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);
    await seedAlertRules(request, stack);

    await openDeck(page, stack.frontendBase, "alerts", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("alerts-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Alert Management" }).first()).toBeVisible();
    await expect(page.getByText("Alerts ready").first()).toBeVisible();
    await expect(page.getByText("3 rules").first()).toBeVisible();
    await expect(page.getByText("Usage warning threshold").first()).toBeVisible();
    await expect(page.getByText("Agent latency breach").first()).toBeVisible();
    await expect(page.getByText("Webhook").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-workbench-ready.png"),
    });

    await page.getByRole("button", { name: "Add Rule" }).click();
    await expect(page.getByText("Define a Deck-local alert rule").first()).toBeVisible();
    await page.locator(".alerts-panel__form").getByRole("button", { name: "Add Rule" }).click();
    await expect(page.getByText("Rule name is required").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-validation-state.png"),
    });

    await page.getByLabel("alert rule name").fill("Approval backlog breach");
    await page.getByLabel("alert entity type").selectOption("approval");
    await page.getByLabel("alert condition").fill(">=");
    await page.getByLabel("alert threshold").fill("12");
    await page.getByLabel("alert action").selectOption("activity");
    await page.getByLabel("alert cooldown minutes").fill("20");

    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/alerts") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      page.locator(".alerts-panel__form").getByRole("button", { name: "Add Rule" }).click(),
    ]);

    await expect(page.getByText("Approval backlog breach").first()).toBeVisible();
    await expect(page.getByText("Last alert action: created").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-create-state.png"),
    });

    await page.getByRole("button", { name: "Fired Alerts" }).click();
    await expect(
      page.getByText("Fired alert history is not exposed by Gateway").first(),
    ).toBeVisible();
    await expect(page.getByText("No fired alerts").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-fired-fallback.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function seedAlertRules(request: APIRequestContext, stack: E2EStack) {
  for (const payload of [
    {
      name: "Usage warning threshold",
      entityType: "usage",
      condition: ">=",
      threshold: 80,
      action: "toast",
      cooldownMs: 300_000,
      enabled: true,
    },
    {
      name: "Agent latency breach",
      entityType: "agent",
      condition: ">",
      threshold: 30,
      action: "webhook",
      cooldownMs: 900_000,
      enabled: true,
    },
    {
      name: "Cron failure burst",
      entityType: "cron",
      condition: ">=",
      threshold: 3,
      action: "activity",
      cooldownMs: 600_000,
      enabled: false,
    },
  ]) {
    const response = await request.post(`${stack.backendBase}/api/alerts`, {
      data: payload,
      headers: authHeaders(stack.accessToken),
    });
    expect(response.ok(), `alerts seed returned ${response.status()}`).toBe(true);
  }
}

function collectUnexpectedErrors(page: Page) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.text().startsWith("Failed to load resource:")) {
        return;
      }
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}
