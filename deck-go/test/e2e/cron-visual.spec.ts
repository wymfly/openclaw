import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

const CRON_VISUAL_VARIANTS = [
  {
    emptyText: "No jobs match the current filters.",
    historyLabel: "History",
    locale: "en" as const,
    navLabel: "Cron Jobs",
    newJobLabel: "New Job",
    readyLabel: "Cron ready",
    schedulerLabel: "Scheduler",
    searchTerm: "quota",
    searchVisible: "Quota recheck",
    theme: "dark" as const,
    title: "Cron Jobs",
  },
  {
    emptyText: "没有任务匹配当前过滤条件。",
    historyLabel: "历史",
    locale: "zh" as const,
    navLabel: "定时任务",
    newJobLabel: "新建任务",
    readyLabel: "Cron 就绪",
    schedulerLabel: "调度器",
    searchTerm: "quota",
    searchVisible: "Quota recheck",
    theme: "dark" as const,
    title: "定时任务",
  },
  {
    emptyText: "No jobs match the current filters.",
    historyLabel: "History",
    locale: "en" as const,
    navLabel: "Cron Jobs",
    newJobLabel: "New Job",
    readyLabel: "Cron ready",
    schedulerLabel: "Scheduler",
    searchTerm: "quota",
    searchVisible: "Quota recheck",
    theme: "light" as const,
    title: "Cron Jobs",
  },
  {
    emptyText: "没有任务匹配当前过滤条件。",
    historyLabel: "历史",
    locale: "zh" as const,
    navLabel: "定时任务",
    newJobLabel: "新建任务",
    readyLabel: "Cron 就绪",
    schedulerLabel: "调度器",
    searchTerm: "quota",
    searchVisible: "Quota recheck",
    theme: "light" as const,
    title: "定时任务",
  },
];

test.describe("cron mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders scheduler workbench, localized variants, and contract-shaped interaction states", async ({
    browser,
  }, testInfo) => {
    for (const variant of CRON_VISUAL_VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = collectUnexpectedErrors(page);

      try {
        await openDeck(page, stack.frontendBase, "cron", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "cron");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);
        await expect(
          page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel }),
        ).toHaveClass(/is-active/);

        const panel = page.getByTestId("cron-panel");
        await expect(panel).toBeVisible();
        await waitForGatewayMethod(stack.requestLog, "cron.list");
        await waitForGatewayMethod(stack.requestLog, "cron.status");
        await waitForGatewayMethod(stack.requestLog, "cron.runs");
        await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
        await expect(panel.getByText(variant.readyLabel).first()).toBeVisible();
        await expect(panel.getByText("Nightly workspace sync").first()).toBeVisible();
        await expect(panel.getByText("Frequent agent heartbeat").first()).toBeVisible();
        await expect(panel.getByText("Weekly usage digest").first()).toBeVisible();
        await expect(panel.getByText("Daily usage rollup").first()).toBeVisible();
        await page.waitForTimeout(500);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(`cron-workbench-${variant.theme}-${variant.locale}.png`),
        });
        if (variant.theme === "dark" && variant.locale === "en") {
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("cron-workbench-ready.png"),
          });
        }

        const search = panel.locator(".cron-panel__search input");
        await search.fill(variant.searchTerm);
        await expect(panel.getByText(variant.searchVisible).first()).toBeVisible();
        await search.fill("missing-job");
        await expect(panel.getByText(variant.emptyText)).toBeVisible();
        await search.fill("");

        await panel.getByRole("tab", { name: variant.historyLabel }).click();
        await expect(panel.getByText(/OK|成功/).first()).toBeVisible();
        await expect(panel.getByText(/Skipped|跳过/).first()).toBeVisible();
        if (variant.theme === "dark" && variant.locale === "en") {
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("cron-run-history.png"),
          });
        }

        await panel.getByRole("tab", { exact: true, name: variant.schedulerLabel }).click();
        await expect(panel.getByText(/read-only|只读/i).first()).toBeVisible();
        if (variant.theme === "dark" && variant.locale === "en") {
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("cron-heartbeat.png"),
          });
        }

        await panel.getByRole("button", { name: variant.newJobLabel }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        if (variant.locale === "en") {
          await page.getByRole("button", { name: "Hourly" }).click();
          await expect(page.getByLabel("cron schedule value")).toHaveValue("0 * * * *");
        }
        await page.getByRole("button", { name: /Close|关闭/ }).click();

        if (variant.theme === "dark" && variant.locale === "en") {
          await panel.getByRole("button", { name: "Run Now" }).click();
          await waitForGatewayMethod(stack.requestLog, "cron.run");
          await expect(panel.getByText("Last cron action").first()).toBeVisible();
          await panel.getByRole("button", { name: "Delete Job" }).click();
          await expect(page.getByRole("dialog", { name: "Delete scheduled job?" })).toBeVisible();
          await page.getByRole("button", { name: "Cancel" }).click();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("cron-template-and-run-result.png"),
          });
        }

        expect(unexpected).toEqual([]);
      } finally {
        await context.close();
      }
    }
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
