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

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-rich",
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });
    await page
      .locator(".deck-ui-rail")
      .getByRole("button", { exact: true, name: "Budget" })
      .click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "budget");

    const panel = page.getByTestId("budget-panel");
    await expect(panel).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "usage.cost");
    await expect(panel.getByRole("heading", { name: "Budget" }).first()).toBeVisible();
    await expect(panel.getByText("Budget ready").first()).toBeVisible();
    await expect(panel.getByText("7 rules").first()).toBeVisible();
    await expect(panel.getByText("Monthly workspace cost cap").first()).toBeVisible();
    await expect(panel.getByText("Main agent token ceiling").first()).toBeVisible();
    await expect(panel.getByText("Definition").first()).toBeVisible();
    await expect(panel.getByText("Recent changes").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-workbench-ready.png"),
    });

    await panel.getByLabel("budget rule search").fill("agent");
    await expect(panel.getByText("Main agent token ceiling").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-filtered-list.png"),
    });

    await panel.getByLabel("budget rule search").fill("");
    await panel.getByRole("tab", { name: /Over/ }).click();
    await expect(panel.getByText("Main agent token ceiling").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-over-filter.png"),
    });

    await panel.getByRole("tab", { name: /All/ }).click();
    await panel.getByRole("button", { name: /Monthly workspace cost cap/ }).click();
    await expect(panel.getByText("Threshold progress").first()).toBeVisible();
    await expect(panel.getByText("No durable recent changes are exposed").first()).toBeVisible();

    await panel.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog", { name: "Edit Rule" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-edit-dialog.png"),
    });
    await page
      .getByRole("dialog", { name: "Edit Rule" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await panel.getByRole("button", { name: "Disable rule" }).click();
    await expect(page.getByRole("dialog", { name: "Disable rule" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-toggle-dialog.png"),
    });
    await page
      .getByRole("dialog", { name: "Disable rule" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await panel.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog", { name: "Delete Rule" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-delete-dialog.png"),
    });
    await page
      .getByRole("dialog", { name: "Delete Rule" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await panel.getByRole("button", { name: "Create" }).click();
    const createDialog = page.getByRole("dialog", { name: "New Rule" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByRole("button", { name: "Save" }).click();
    await expect(createDialog.getByText("Rule name is required")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-validation-state.png"),
    });

    await createDialog.getByLabel("budget rule name").fill("Daily research input cap");
    await createDialog.getByRole("button", { name: "Per Task", exact: true }).click();
    await createDialog.getByLabel("budget task id").fill("research-summary");
    await createDialog.getByRole("button", { name: "Input Tokens", exact: true }).click();
    await createDialog.getByRole("button", { name: "Daily", exact: true }).click();
    await createDialog.getByLabel("budget warn threshold").fill("100000");
    await createDialog.getByLabel("budget over threshold").fill("180000");

    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/usage/budget") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      createDialog.getByRole("button", { name: "Save" }).click(),
    ]);

    await expect(panel.getByText("Daily research input cap").first()).toBeVisible();
    await expect(panel.getByText("Last budget action: created").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-create-state.png"),
    });

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-rich",
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    await page.locator(".deck-ui-rail").getByRole("button", { exact: true, name: "预算" }).click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "budget");
    const zhPanel = page.getByTestId("budget-panel");
    await expect(zhPanel.getByText("预算管理").first()).toBeVisible();
    await expect(zhPanel.getByText("8 条规则").first()).toBeVisible();
    await zhPanel.getByLabel("budget rule search").fill("token");
    await expect(zhPanel.getByText("Main agent token ceiling").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("budget-zh-light-list.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function seedBudgetRules(request: APIRequestContext, stack: E2EStack) {
  for (const payload of [
    {
      name: "Monthly workspace cost cap",
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
    {
      name: "Daily all-agent cost guardrail",
      scope: "global",
      dimension: "cost",
      warnThreshold: 8,
      overThreshold: 12,
      period: "daily",
      enabled: true,
    },
    {
      name: "Review task cost ceiling",
      scope: "task",
      taskId: "review-pool",
      dimension: "cost",
      warnThreshold: 0.4,
      overThreshold: 0.75,
      period: "daily",
      enabled: true,
    },
    {
      name: "Build bot input token budget",
      scope: "agent",
      agentId: "build-bot",
      dimension: "tokensIn",
      warnThreshold: 600_000,
      overThreshold: 900_000,
      period: "daily",
      enabled: false,
    },
    {
      name: "Output token weekly cap",
      scope: "agent",
      agentId: "review-pool",
      dimension: "tokensOut",
      warnThreshold: 30_000,
      overThreshold: 60_000,
      period: "weekly",
      enabled: true,
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
