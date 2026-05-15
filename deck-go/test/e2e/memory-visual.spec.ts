import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

const MEMORY_VISUAL_VARIANTS = [
  {
    browseTab: "Browse",
    cancelConfirm: "No",
    dedupeLabel: "Dedupe",
    dreamsTab: "Dreams",
    healthTab: "Health",
    locale: "en" as const,
    navLabel: "Memory",
    rawHealth: "Raw health response",
    resetShortTermLabel: "Reset short-term",
    searchButton: "Search memory",
    searchPlaceholder: "search memory",
    searchTab: "Search",
    theme: "dark" as const,
    title: "Memory",
  },
  {
    browseTab: "浏览",
    cancelConfirm: "否",
    dedupeLabel: "去重",
    dreamsTab: "梦境",
    healthTab: "健康诊断",
    locale: "zh" as const,
    navLabel: "记忆",
    rawHealth: "原始健康响应",
    resetShortTermLabel: "重置短期",
    searchButton: "搜索记忆",
    searchPlaceholder: "搜索记忆",
    searchTab: "搜索",
    theme: "dark" as const,
    title: "记忆",
  },
  {
    browseTab: "Browse",
    cancelConfirm: "No",
    dedupeLabel: "Dedupe",
    dreamsTab: "Dreams",
    healthTab: "Health",
    locale: "en" as const,
    navLabel: "Memory",
    rawHealth: "Raw health response",
    resetShortTermLabel: "Reset short-term",
    searchButton: "Search memory",
    searchPlaceholder: "search memory",
    searchTab: "Search",
    theme: "light" as const,
    title: "Memory",
  },
  {
    browseTab: "浏览",
    cancelConfirm: "否",
    dedupeLabel: "去重",
    dreamsTab: "梦境",
    healthTab: "健康诊断",
    locale: "zh" as const,
    navLabel: "记忆",
    rawHealth: "原始健康响应",
    resetShortTermLabel: "重置短期",
    searchButton: "搜索记忆",
    searchPlaceholder: "搜索记忆",
    searchTab: "搜索",
    theme: "light" as const,
    title: "记忆",
  },
];

test.describe("memory mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders memory workspace, variants, and contract-shaped interaction states", async ({
    browser,
  }, testInfo) => {
    for (const variant of MEMORY_VISUAL_VARIANTS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = collectUnexpectedErrors(page);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        const memoryNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await memoryNav.scrollIntoViewIfNeeded();
        await memoryNav.click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "memory");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("memory-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByText(variant.title).first()).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.browseTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.searchTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.healthTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: variant.dreamsTab })).toBeVisible();
        await expect(panel.getByRole("tab", { name: /Graph|图谱/ })).toHaveCount(0);
        await expect(panel.getByText("daily.md").first()).toBeVisible();
        await expect(panel.getByText("archive").first()).toBeVisible();
        await expect(panel.getByText("remembered context").first()).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.locale === "en" && variant.theme === "dark"
              ? "memory-workspace-ready.png"
              : `memory-workspace-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.locale === "en" && variant.theme === "dark") {
          await expect(panel.getByRole("heading", { name: "remembered context" })).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("memory-file-read.png"),
          });
        }

        await panel.getByRole("tab", { name: variant.searchTab }).click();
        await panel.getByPlaceholder(variant.searchPlaceholder).fill("contract-led");
        await panel.getByRole("button", { name: variant.searchButton }).click();
        await expect(panel.getByText(/Not implemented|需要 LanceDB/).first()).toBeVisible();
        if (variant.locale === "en" && variant.theme === "dark") {
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("memory-search-unavailable.png"),
          });
        }

        await panel.getByRole("tab", { name: variant.healthTab }).click();
        await expect(panel.getByText("mock-embedding").first()).toBeVisible();
        await expect(panel.getByText(variant.rawHealth)).toBeVisible();
        if (variant.locale === "en" && variant.theme === "dark") {
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("memory-health.png"),
          });
        }

        await panel.getByRole("tab", { name: variant.dreamsTab }).click();
        await expect(panel.getByRole("heading", { name: /Dream Diary|梦境日记/ })).toBeVisible();
        await expect(panel.getByText(".openclaw/memory/dream-diary.md").first()).toBeVisible();
        await panel.getByRole("button", { name: variant.dedupeLabel }).click();
        await expect(panel.getByText(/Dream diary action result|梦境日记操作结果/)).toBeVisible();
        await panel.getByRole("button", { name: variant.resetShortTermLabel }).click();
        await expect(panel.getByText(/Run memory dreams|运行记忆梦境/).first()).toBeVisible();
        await panel.getByRole("button", { name: variant.cancelConfirm, exact: true }).click();
        if (variant.locale === "en" && variant.theme === "dark") {
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("memory-dreams.png"),
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
    if (status === 501 && response.url().includes("/api/memory/search")) {
      return;
    }
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}
