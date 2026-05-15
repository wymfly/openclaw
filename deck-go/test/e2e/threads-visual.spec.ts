import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

type Variant = {
  activity: string;
  activityUnsupported: string;
  audit: string;
  auditUnsupported: string;
  navLabel: string;
  raw: string;
  ready: RegExp;
  searchPlaceholder: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    activity: "Recent activity",
    activityUnsupported: "No thread activity projection",
    audit: "Audit",
    auditUnsupported: "No thread audit projection",
    navLabel: "Threads",
    raw: "Raw entry",
    ready: /Threads ready/,
    searchPlaceholder: "Search thread / channel / agent / session / label / account",
    theme: "dark",
    locale: "en",
    title: "Thread Bindings",
  },
  {
    activity: "最近活动",
    activityUnsupported: "暂无线程活动投影",
    audit: "审计",
    auditUnsupported: "暂无线程审计投影",
    navLabel: "线程",
    raw: "原始条目",
    ready: /线程.*就绪/,
    searchPlaceholder: "搜索线程 / 渠道 / 智能体 / 会话 / 标签 / 账号",
    theme: "dark",
    locale: "zh",
    title: "线程绑定",
  },
  {
    activity: "Recent activity",
    activityUnsupported: "No thread activity projection",
    audit: "Audit",
    auditUnsupported: "No thread audit projection",
    navLabel: "Threads",
    raw: "Raw entry",
    ready: /Threads ready/,
    searchPlaceholder: "Search thread / channel / agent / session / label / account",
    theme: "light",
    locale: "en",
    title: "Thread Bindings",
  },
  {
    activity: "最近活动",
    activityUnsupported: "暂无线程活动投影",
    audit: "审计",
    auditUnsupported: "暂无线程审计投影",
    navLabel: "线程",
    raw: "原始条目",
    ready: /线程.*就绪/,
    searchPlaceholder: "搜索线程 / 渠道 / 智能体 / 会话 / 标签 / 账号",
    theme: "light",
    locale: "zh",
    title: "线程绑定",
  },
];

test.describe("threads mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders thread binding registry variants with contract-shaped mock data", async ({
    browser,
  }, testInfo) => {
    for (const variant of VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = collectUnexpectedErrors(page);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        const threadsNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await threadsNav.scrollIntoViewIfNeeded();
        await threadsNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "threads",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("threads-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();
        await expect(panel.getByText(variant.ready)).toBeVisible();
        await expect(panel.locator(".threads-panel__thread-row")).toHaveCount(10);
        await expect(panel.getByText("discord:incidents#fire").first()).toBeVisible();
        await expect(
          panel.locator(".threads-panel__thread-row").filter({ hasText: "external-bot" }).first(),
        ).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.theme === "dark" && variant.locale === "en"
              ? "threads-workspace-ready.png"
              : `threads-workbench-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.theme === "dark" && variant.locale === "en") {
          await panel.getByPlaceholder(variant.searchPlaceholder).fill("slack");
          await expect(panel.locator(".threads-panel__thread-row")).toHaveCount(2);
          await expect(
            panel
              .locator(".threads-panel__thread-row")
              .filter({ hasText: "Slack platform escalation" }),
          ).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("threads-filtered-slack.png"),
          });

          await panel.getByRole("button", { name: /Slack platform escalation/ }).click();
          await panel.getByRole("tab", { name: variant.activity }).click();
          await expect(panel.getByText(variant.activityUnsupported)).toBeVisible();
          await panel.getByRole("tab", { name: variant.audit }).click();
          await expect(panel.getByText(variant.auditUnsupported)).toBeVisible();
          await panel.getByRole("tab", { name: variant.raw }).click();
          await expect(panel.getByText("Thread payload")).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("threads-detail-raw-unsupported.png"),
          });

          await panel.getByRole("button", { name: "Copy session key" }).click();
          await expect(panel.locator(".threads-panel__handoff")).toContainText(/session key/i);
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("threads-copy-feedback.png"),
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
