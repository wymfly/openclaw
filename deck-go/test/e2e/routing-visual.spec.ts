import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

type Variant = {
  addBinding: string;
  cancel: string;
  closeDraft: string;
  confirmTitle: string;
  navLabel: string;
  patchScope: string;
  ready: string;
  removeBinding: string;
  simulate: string;
  simulationResult: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    addBinding: "Add binding...",
    cancel: "Cancel",
    closeDraft: "Close draft",
    confirmTitle: "Confirm routing action",
    navLabel: "Routing",
    patchScope: "Patch DM scope",
    ready: "Routing ready",
    removeBinding: "Remove binding",
    simulate: "Simulate",
    simulationResult: "Simulation result",
    theme: "dark",
    locale: "en",
    title: "Agent route workbench",
  },
  {
    addBinding: "添加绑定...",
    cancel: "取消",
    closeDraft: "关闭草稿",
    confirmTitle: "确认路由操作",
    navLabel: "消息路由",
    patchScope: "更新 DM scope",
    ready: "路由就绪",
    removeBinding: "移除绑定",
    simulate: "模拟",
    simulationResult: "模拟结果",
    theme: "dark",
    locale: "zh",
    title: "智能体路由工作台",
  },
  {
    addBinding: "Add binding...",
    cancel: "Cancel",
    closeDraft: "Close draft",
    confirmTitle: "Confirm routing action",
    navLabel: "Routing",
    patchScope: "Patch DM scope",
    ready: "Routing ready",
    removeBinding: "Remove binding",
    simulate: "Simulate",
    simulationResult: "Simulation result",
    theme: "light",
    locale: "en",
    title: "Agent route workbench",
  },
  {
    addBinding: "添加绑定...",
    cancel: "取消",
    closeDraft: "关闭草稿",
    confirmTitle: "确认路由操作",
    navLabel: "消息路由",
    patchScope: "更新 DM scope",
    ready: "路由就绪",
    removeBinding: "移除绑定",
    simulate: "模拟",
    simulationResult: "模拟结果",
    theme: "light",
    locale: "zh",
    title: "智能体路由工作台",
  },
];

test.describe("routing mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders routing workbench variants and simulation with contract-shaped mock data", async ({
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

        const routingNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await routingNav.scrollIntoViewIfNeeded();
        await routingNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "routing",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("routing-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByText(variant.title)).toBeVisible();
        await expect(panel.getByText(variant.ready)).toBeVisible();
        await expect(panel.getByText("8").first()).toBeVisible();
        await expect(panel.getByText("9af31c2d").first()).toBeVisible();
        await expect(panel.getByText("finance-lead").first()).toBeVisible();
        await expect(panel.locator(".routing-binding-row")).toHaveCount(8);
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.theme === "dark" && variant.locale === "en"
              ? "routing-workbench-ready.png"
              : `routing-workbench-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.theme === "dark" && variant.locale === "en") {
          await panel.getByRole("button", { name: variant.addBinding }).click();
          await expect(panel.getByText("Add or validate binding")).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("routing-add-draft.png"),
          });
          await panel
            .locator(".routing-draft")
            .getByRole("button", { name: variant.closeDraft })
            .click();

          await panel.getByRole("button", { name: variant.removeBinding }).click();
          await expect(panel.getByText(variant.confirmTitle)).toBeVisible();
          await panel.getByRole("button", { name: variant.cancel }).click();
          await expect(panel.getByText(variant.confirmTitle)).toHaveCount(0);
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("routing-remove-confirm-cancelled.png"),
          });

          const scopeSelect = panel.getByLabel("DM scope strategy");
          await scopeSelect.selectOption("per-account-channel-peer");
          await panel.getByRole("button", { name: variant.patchScope }).click();
          await expect(panel.getByText(variant.confirmTitle)).toBeVisible();
          await panel.getByRole("button", { name: variant.cancel }).click();

          await panel.getByRole("button", { name: variant.simulate }).click();
          await expect(panel.getByText(variant.simulationResult)).toBeVisible();
          await expect(
            panel.locator(".routing-result").getByText("agent:ops:discord:finance-lead").first(),
          ).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("routing-simulation-result.png"),
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
