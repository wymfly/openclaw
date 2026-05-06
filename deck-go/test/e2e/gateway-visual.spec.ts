import { expect, test, type Page } from "@playwright/test";
import { authHeaders, openDeck, startBundledStack, type E2EStack } from "./helpers";

const GATEWAY_VISUAL_VARIANTS = [
  {
    activityTab: "Activity",
    batchTab: "Batch console",
    eventLabel: "Events",
    locale: "en" as const,
    navLabel: "Monitor",
    readLabel: "read",
    runBatchLabel: "Run batch",
    searchLabel: "Search",
    theme: "dark" as const,
    title: "Gateway control plane",
  },
  {
    activityTab: "活动",
    batchTab: "批量控制台",
    eventLabel: "事件",
    locale: "zh" as const,
    navLabel: "监控",
    readLabel: "读",
    runBatchLabel: "执行批量",
    searchLabel: "搜索",
    theme: "dark" as const,
    title: "Gateway 控制平面",
  },
  {
    activityTab: "Activity",
    batchTab: "Batch console",
    eventLabel: "Events",
    locale: "en" as const,
    navLabel: "Monitor",
    readLabel: "read",
    runBatchLabel: "Run batch",
    searchLabel: "Search",
    theme: "light" as const,
    title: "Gateway control plane",
  },
  {
    activityTab: "活动",
    batchTab: "批量控制台",
    eventLabel: "事件",
    locale: "zh" as const,
    navLabel: "监控",
    readLabel: "读",
    runBatchLabel: "执行批量",
    searchLabel: "搜索",
    theme: "light" as const,
    title: "Gateway 控制平面",
  },
];

test.describe("gateway mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders gateway v2 control plane with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    const subscribe = await page.request.post(`${stack.backendBase}/api/chat/session-events`, {
      data: { action: "subscribe", sessionKey: "agent:main:visual" },
      headers: authHeaders(stack.accessToken),
    });
    expect(subscribe.ok(), `mock subscription returned ${subscribe.status()}`).toBe(true);

    for (const variant of GATEWAY_VISUAL_VARIANTS) {
      await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
        locale: variant.locale,
        nav: "expanded",
        theme: variant.theme,
      });

      const gatewayNav = page
        .locator(".deck-ui-rail")
        .getByRole("button", { exact: true, name: variant.navLabel });
      await gatewayNav.scrollIntoViewIfNeeded();
      await gatewayNav.click();
      await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "gateway");
      await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

      const panel = page.getByTestId("gateway-panel");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();
      const gatewayDescribeRow = panel
        .locator(".describe-row")
        .filter({ hasText: "gateway.describe" })
        .first();
      await expect(gatewayDescribeRow).toBeVisible();
      await expect(panel.getByText("legacy.raw")).toBeVisible();
      await expect(panel.getByText(/BFF projection|BFF 投影/).first()).toBeVisible();
      await expect(
        panel.getByRole("heading", { name: /Runtime Gateway|运行时 Gateway/ }),
      ).toBeVisible();

      await page.waitForTimeout(500);
      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath(`gateway-control-plane-${variant.theme}-${variant.locale}.png`),
      });
      if (variant.theme === "dark" && variant.locale === "en") {
        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath("gateway-control-plane-ready.png"),
        });
      }

      await panel.getByLabel(variant.searchLabel).fill("gateway.describe");
      await expect(gatewayDescribeRow).toBeVisible();
      await panel.getByRole("tab", { name: variant.readLabel, exact: true }).click();
      await panel.getByLabel(variant.searchLabel).fill("");
      await panel.getByRole("tab", { name: new RegExp(`^${variant.eventLabel}`) }).click();
      await expect(panel.getByText("activity.event").first()).toBeVisible();
      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath(`gateway-describe-events-${variant.theme}-${variant.locale}.png`),
      });

      await panel.getByRole("tab", { name: new RegExp(variant.batchTab) }).click();
      await expect(panel.getByRole("heading", { name: variant.batchTab })).toBeVisible();
      await expect(panel.getByText(/Bundled-mode composer|仅在 bundled 模式下/)).toBeVisible();
      const runButton = panel.getByRole("button", { name: variant.runBatchLabel });
      await expect(runButton).toBeVisible();
      if (await runButton.isEnabled()) {
        await runButton.click();
        await expect(panel.getByText(/1 batches|1 批量/)).toBeVisible();
        await expect(panel.getByText(/1 calls|1 调用/)).toBeVisible();
      }
      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath(`gateway-batch-${variant.theme}-${variant.locale}.png`),
      });
      if (variant.theme === "dark" && variant.locale === "en") {
        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath("gateway-batch-state.png"),
        });
      }

      await panel.getByRole("tab", { name: new RegExp(variant.activityTab) }).click();
      await expect(panel.getByRole("heading", { name: /Recent activity|最近活动/ })).toBeVisible();
      await expect(panel.getByText("Chat run completed").first()).toBeVisible();
      await expect(panel.getByText("run-visual-1").first()).toBeVisible();
      await page.screenshot({
        fullPage: false,
        path: testInfo.outputPath(`gateway-activity-${variant.theme}-${variant.locale}.png`),
      });
      if (variant.theme === "dark" && variant.locale === "en") {
        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath("gateway-activity-state.png"),
        });
      }
    }

    expect(unexpected).toEqual([]);
  });
});

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
