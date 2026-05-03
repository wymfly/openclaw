import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  startBundledStack,
  waitForGatewayMethod,
  type E2EStack,
} from "./helpers";

test.describe("budget mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders budget governance workbench and contract-shaped mutation state", async ({
    page,
    request,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);
    await seedBudgetRules(request, stack);

    await openDeck(page, stack.frontendBase, "budget", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("budget-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "usage.cost");
    await expect(page.getByRole("heading", { name: "Budget" }).first()).toBeVisible();
    await expect(page.getByText("Budget ready").first()).toBeVisible();
    await expect(page.getByText("3 rules").first()).toBeVisible();
    await expect(page.getByText("Monthly cost cap").first()).toBeVisible();
    await expect(page.getByText("Main agent token ceiling").first()).toBeVisible();
    await expect(page.getByText("Over limit").first()).toBeVisible();
    await expect(page.getByText("$4.13").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-workbench-ready.png"),
    });

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("New Rule").first()).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Rule name is required").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-validation-state.png"),
    });

    await page.getByLabel("budget rule name").fill("Daily research input cap");
    await page.getByRole("button", { name: "Per Task", exact: true }).click();
    await page.getByLabel("budget task id").fill("research-summary");
    await page.getByRole("button", { name: "Input Tokens", exact: true }).click();
    await page.getByRole("button", { name: "Daily", exact: true }).click();
    await page.getByLabel("budget warn threshold").fill("100000");
    await page.getByLabel("budget over threshold").fill("180000");

    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/usage/budget") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      page.getByRole("button", { name: "Save" }).click(),
    ]);

    await expect(page.getByText("Daily research input cap").first()).toBeVisible();
    await expect(page.getByText("Last budget action: created").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-create-state.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function seedBudgetRules(request: APIRequestContext, stack: E2EStack) {
  for (const payload of [
    {
      name: "Monthly cost cap",
      scope: "global",
      dimension: "cost",
      warnThreshold: 4,
      overThreshold: 10,
      period: "monthly",
      enabled: true,
    },
    {
      name: "Main agent token ceiling",
      scope: "agent",
      agentId: "main",
      dimension: "totalTokens",
      warnThreshold: 120_000,
      overThreshold: 180_000,
      period: "weekly",
      enabled: true,
    },
    {
      name: "Research task input guardrail",
      scope: "task",
      taskId: "research-summary",
      dimension: "tokensIn",
      warnThreshold: 80_000,
      overThreshold: 120_000,
      period: "daily",
      enabled: false,
    },
  ]) {
    const response = await request.post(`${stack.backendBase}/api/usage/budget`, {
      data: payload,
      headers: authHeaders(stack.accessToken),
    });
    expect(response.ok(), `budget seed returned ${response.status()}`).toBe(true);
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
