import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

type Variant = {
  byModel: string;
  context: string;
  logs: string;
  navLabel: string;
  ready: RegExp;
  searchPlaceholder: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  timeseries: string;
  title: string;
  windowSummary: string;
};

const VARIANTS: Variant[] = [
  {
    byModel: "By model",
    context: "Context",
    logs: "Logs",
    navLabel: "Usage",
    ready: /Usage ready/,
    searchPlaceholder: "search usage sessions",
    theme: "dark",
    locale: "en",
    timeseries: "Timeseries",
    title: "Usage operations cockpit",
    windowSummary: "14 days",
  },
  {
    byModel: "按模型",
    context: "上下文",
    logs: "日志",
    navLabel: "用量",
    ready: /用量.*就绪/,
    searchPlaceholder: "搜索用量会话",
    theme: "dark",
    locale: "zh",
    timeseries: "时间序列",
    title: "用量运营驾驶舱",
    windowSummary: "14 天",
  },
  {
    byModel: "By model",
    context: "Context",
    logs: "Logs",
    navLabel: "Usage",
    ready: /Usage ready/,
    searchPlaceholder: "search usage sessions",
    theme: "light",
    locale: "en",
    timeseries: "Timeseries",
    title: "Usage operations cockpit",
    windowSummary: "14 days",
  },
  {
    byModel: "按模型",
    context: "上下文",
    logs: "日志",
    navLabel: "用量",
    ready: /用量.*就绪/,
    searchPlaceholder: "搜索用量会话",
    theme: "light",
    locale: "zh",
    timeseries: "时间序列",
    title: "用量运营驾驶舱",
    windowSummary: "14 天",
  },
];

test.describe("usage mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders usage cockpit variants with contract-shaped mock data", async ({
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

        const usageNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await usageNav.scrollIntoViewIfNeeded();
        await usageNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "usage");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("usage-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();
        await expect(panel.getByText(variant.ready)).toBeVisible();
        await expect(panel.getByText(variant.windowSummary).first()).toBeVisible();
        await expect(panel.getByText(/4 providers|4 个供应商/).first()).toBeVisible();
        await expect(panel.getByText("Anthropic").first()).toBeVisible();
        await expect(panel.getByText("OpenAI").first()).toBeVisible();
        await expect(panel.getByText("Google AI").first()).toBeVisible();
        await expect(panel.getByText(/Local fallback|Local/).first()).toBeVisible();
        await expect(panel.locator(".usage-panel__sessions > .usage-panel__list > li")).toHaveCount(
          8,
        );
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.theme === "dark" && variant.locale === "en"
              ? "usage-cockpit-ready.png"
              : `usage-cockpit-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.theme === "dark" && variant.locale === "en") {
          await panel.getByRole("button", { name: variant.byModel }).click();
          await expect(
            panel.getByTestId("usage-trend-chart").getByText("gpt-5.4-mini"),
          ).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("usage-trend-by-model.png"),
          });

          await panel.getByRole("button", { name: /OpenAI/ }).click();
          await expect(
            panel.locator(".usage-panel__provider .deckgo-stat-value").getByText("openai"),
          ).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("usage-provider-selected.png"),
          });

          await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
          await expect(panel.getByPlaceholder(variant.searchPlaceholder)).toBeFocused();
          await panel.getByPlaceholder(variant.searchPlaceholder).fill("validation");
          await expect(panel.getByText("Builder validation")).toBeVisible();
          await expect(
            panel.locator(".usage-panel__sessions > .usage-panel__list > li"),
          ).toHaveCount(1);
          await panel.getByRole("button", { name: /Builder validation/ }).click();
          await panel.getByRole("tab", { name: variant.logs }).click();
          await expect(panel.getByText("usage log detail")).toBeVisible();
          await panel.getByRole("tab", { name: variant.timeseries }).click();
          await expect(panel.getByText("Usage timeseries")).toBeVisible();
          await panel.getByRole("tab", { name: variant.context }).click();
          await expect(panel.getByText("Context weight", { exact: true })).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("usage-session-drilldown.png"),
          });

          await page.keyboard.press("Escape");
          await expect(panel.getByText("Open usage session")).toHaveCount(0);
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
