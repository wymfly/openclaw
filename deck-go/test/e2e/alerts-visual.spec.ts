import { expect, test, type Page } from "@playwright/test";
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

  test("renders alert rules workbench and fallback states with contract-shaped local data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);
    await seedAlertRules(page, stack);

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-rich",
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });
    const enAlertsNav = page
      .locator(".deck-ui-rail")
      .getByRole("button", { exact: true, name: "Alerts" });
    await enAlertsNav.scrollIntoViewIfNeeded();
    await enAlertsNav.click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "alerts");

    const panel = page.getByTestId("alerts-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Alert Management" })).toBeVisible();
    await expect(panel.getByText("12 rules").first()).toBeVisible();
    await expect(panel.getByText("Discord WebSocket reconnect threshold").first()).toBeVisible();
    await expect(panel.getByText("Subagent failed-run rate").first()).toBeVisible();
    await expect(panel.getByText("Condition").first()).toBeVisible();
    await expect(panel.getByText("Last fired").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-workbench-ready.png"),
    });

    await panel.getByLabel("alert search").fill("subagent");
    await expect(panel.getByText("Subagent failed-run rate")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-filtered-list.png"),
    });

    await panel.getByLabel("alert search").fill("");
    await panel
      .getByRole("button", { exact: true, name: "Discord WebSocket reconnect threshold" })
      .click();
    await expect(panel.getByRole("tab", { name: "Overview" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-detail-overview.png"),
    });
    await panel.getByRole("tab", { name: "Conditions" }).click();
    await expect(panel.getByText("Condition DSL")).toBeVisible();
    await panel.getByRole("tab", { name: "Recent fires" }).click();
    await expect(
      panel.getByText("Fired alert history is not exposed by the Alerts contract"),
    ).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-fires-fallback.png"),
    });
    await panel.getByRole("tab", { name: "Audit" }).click();
    await expect(
      panel.getByText("Audit history is not exposed by the Alerts contract"),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Test fire" }).click();
    await expect(page.getByRole("dialog", { name: "Test fire" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-test-fire-preview.png"),
    });
    await page
      .getByRole("dialog", { name: "Test fire" })
      .getByRole("button", { name: "Close" })
      .click();
    await panel.getByRole("button", { name: "Edit Rule" }).click();
    await expect(page.getByRole("dialog", { name: "Edit Rule" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-edit-dialog.png"),
    });
    await page
      .getByRole("dialog", { name: "Edit Rule" })
      .getByRole("button", { name: "Cancel" })
      .first()
      .click();
    await panel.getByRole("button", { name: "Delete Rule" }).click();
    await expect(page.getByRole("dialog", { name: "Delete Rule" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-delete-dialog.png"),
    });
    await page
      .getByRole("dialog", { name: "Delete Rule" })
      .getByRole("button", { name: "Cancel" })
      .click();
    await panel.getByRole("button", { name: "Back to rules" }).click();

    await panel.getByRole("button", { name: "Add Rule" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add Rule" });
    await expect(dialog).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-create-dialog.png"),
    });
    await dialog.getByRole("button", { name: "Cancel" }).first().click();

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-rich",
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    const zhAlertsNav = page
      .locator(".deck-ui-rail")
      .getByRole("button", { exact: true, name: "告警" });
    await zhAlertsNav.scrollIntoViewIfNeeded();
    await zhAlertsNav.click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "alerts");
    const zhPanel = page.getByTestId("alerts-panel");
    await expect(zhPanel.getByText("告警管理").first()).toBeVisible();
    await expect(zhPanel.getByText("12 条规则").first()).toBeVisible();
    await zhPanel.getByLabel("alert search").fill("routing");
    await expect(zhPanel.getByText("Routing loop detected")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("alerts-zh-light-list.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function seedAlertRules(page: Page, stack: E2EStack) {
  const headers = authHeaders(stack.accessToken);
  for (const rule of [
    {
      name: "Discord WebSocket reconnect threshold",
      entityType: "channel",
      condition: "ws_reconnect_count_5m > threshold",
      threshold: 3,
      action: "activity",
      cooldownMs: 300000,
      enabled: true,
    },
    {
      name: "Subagent failed-run rate",
      entityType: "subagent",
      condition: "failed_runs_15m > threshold",
      threshold: 3,
      action: "toast",
      cooldownMs: 600000,
      enabled: true,
    },
    {
      name: "Per-model token burst",
      entityType: "model",
      condition: "input_tokens_1m > threshold",
      threshold: 50000,
      action: "webhook",
      cooldownMs: 900000,
      enabled: true,
    },
    {
      name: "Hourly spend cap (USD)",
      entityType: "budget",
      condition: "spend_usd_1h > threshold",
      threshold: 8,
      action: "webhook",
      cooldownMs: 1800000,
      enabled: true,
    },
    {
      name: "Approval expiry without decision",
      entityType: "approval",
      condition: "expired_no_decision > threshold",
      threshold: 1,
      action: "toast",
      cooldownMs: 300000,
      enabled: true,
    },
    {
      name: "Signal-CLI runtime missing",
      entityType: "plugin",
      condition: "diagnostic_level=error_persists > threshold",
      threshold: 1,
      action: "activity",
      cooldownMs: 1800000,
      enabled: true,
    },
    {
      name: "Long-idle agent session",
      entityType: "session",
      condition: "idle_minutes > threshold",
      threshold: 60,
      action: "activity",
      cooldownMs: 3600000,
      enabled: false,
    },
    {
      name: "Test flake regression",
      entityType: "test",
      condition: "flake_rate_24h_pct > threshold",
      threshold: 5,
      action: "webhook",
      cooldownMs: 14400000,
      enabled: true,
    },
    {
      name: "OAuth credential approaching expiry",
      entityType: "auth",
      condition: "expires_in_days < threshold",
      threshold: 7,
      action: "toast",
      cooldownMs: 86400000,
      enabled: false,
    },
    {
      name: "QA test block at PR merge",
      entityType: "pr",
      condition: "qa_failures_at_merge > threshold",
      threshold: 1,
      action: "toast",
      cooldownMs: 1800000,
      enabled: true,
    },
    {
      name: "Provider 429 rate-limit cluster",
      entityType: "provider",
      condition: "rate_limit_errors_5m > threshold",
      threshold: 5,
      action: "webhook",
      cooldownMs: 600000,
      enabled: false,
    },
    {
      name: "Routing loop detected",
      entityType: "routing",
      condition: "redirect_depth > threshold",
      threshold: 5,
      action: "activity",
      cooldownMs: 600000,
      enabled: true,
    },
  ]) {
    const response = await page.request.post(`${stack.backendBase}/api/alerts`, {
      data: rule,
      headers,
    });
    expect(response.ok(), `seed alert returned ${response.status()}`).toBe(true);
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
