import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, waitForGatewayMethod, type E2EStack } from "./helpers";

type Variant = {
  connectedLabel: string;
  navLabel: string;
  nodeCountLabel: string;
  pendingCountLabel: string;
  pendingWorkButton: string;
  refreshLabel: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  confirmLabel: string;
  invokeButton: string;
  invokeParamsLabel: string;
  invokeTitle: RegExp;
};

const VARIANTS: Variant[] = [
  {
    connectedLabel: "connected",
    navLabel: "Nodes",
    nodeCountLabel: "5 nodes",
    pendingCountLabel: "2 pending",
    pendingWorkButton: "Queue pending work",
    refreshLabel: "Refresh nodes",
    theme: "dark",
    locale: "en",
    confirmLabel: "Confirm",
    invokeButton: "Invoke command",
    invokeParamsLabel: "Node invoke params JSON",
    invokeTitle: /Invoke command\?/,
  },
  {
    connectedLabel: "已连接",
    navLabel: "节点",
    nodeCountLabel: "5 个节点",
    pendingCountLabel: "2 个待处理",
    pendingWorkButton: "排队待处理工作",
    refreshLabel: "刷新节点",
    theme: "dark",
    locale: "zh",
    confirmLabel: "确认",
    invokeButton: "调用命令",
    invokeParamsLabel: "节点调用参数 JSON",
    invokeTitle: /调用命令\?/,
  },
  {
    connectedLabel: "connected",
    navLabel: "Nodes",
    nodeCountLabel: "5 nodes",
    pendingCountLabel: "2 pending",
    pendingWorkButton: "Queue pending work",
    refreshLabel: "Refresh nodes",
    theme: "light",
    locale: "en",
    confirmLabel: "Confirm",
    invokeButton: "Invoke command",
    invokeParamsLabel: "Node invoke params JSON",
    invokeTitle: /Invoke command\?/,
  },
  {
    connectedLabel: "已连接",
    navLabel: "节点",
    nodeCountLabel: "5 个节点",
    pendingCountLabel: "2 个待处理",
    pendingWorkButton: "排队待处理工作",
    refreshLabel: "刷新节点",
    theme: "light",
    locale: "zh",
    confirmLabel: "确认",
    invokeButton: "调用命令",
    invokeParamsLabel: "节点调用参数 JSON",
    invokeTitle: /调用命令\?/,
  },
];

test.describe("nodes mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders node operations workbench variants and guarded dynamic action states", async ({
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

        const nodeNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await nodeNav.scrollIntoViewIfNeeded();
        await nodeNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "nodes");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("nodes-panel");
        await expect(panel).toBeVisible();
        await waitForGatewayMethod(stack.requestLog, "node.list");
        await waitForGatewayMethod(stack.requestLog, "node.pair.list");
        await waitForGatewayMethod(stack.requestLog, "node.describe");
        await expect(panel.getByRole("button", { name: variant.refreshLabel })).toBeVisible();
        await expect(panel.getByText(variant.nodeCountLabel).first()).toBeVisible();
        await expect(panel.getByText(variant.pendingCountLabel).first()).toBeVisible();
        await expect(panel.getByText("Alpha Control Mac").first()).toBeVisible();
        await expect(panel.getByText("Beta Field Node").first()).toBeVisible();
        await expect(panel.getByText("Gamma Workstation").first()).toBeVisible();
        await expect(panel.getByText("Delta Edge Probe").first()).toBeVisible();
        await expect(panel.getByText(variant.connectedLabel).first()).toBeVisible();
        await expect(panel.getByText(/pair-beta-repair|pair-orphan-kiosk/).first()).toBeVisible();
        await expect(panel.getByText(/Invoke node command|调用节点命令/).first()).toBeVisible();
        await expect(panel.getByText(/Pending work|待处理工作/).first()).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          )
          .toBe(true);

        await page.screenshot({
          fullPage: false,
          path: testInfo.outputPath(
            variant.theme === "dark" && variant.locale === "en"
              ? "nodes-workbench-ready.png"
              : `nodes-workbench-${variant.theme}-${variant.locale}.png`,
          ),
        });

        if (variant.theme === "dark" && variant.locale === "en") {
          await expect(panel.getByText("Repair requested").first()).toBeVisible();
          await expect(panel.getByText("Review the repair request").first()).toBeVisible();
          await expect(panel.getByText("shell: denied").first()).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("nodes-pairing-repair-state.png"),
          });

          await panel.getByLabel(variant.invokeParamsLabel).fill('{"message":"mock visual probe"}');
          await panel.getByRole("button", { name: variant.invokeButton }).click();
          await expect(panel.getByRole("alertdialog", { name: variant.invokeTitle })).toBeVisible();
          await Promise.all([
            page.waitForResponse((response) => {
              return (
                response.url().includes("/api/nodes") &&
                response.request().method() === "POST" &&
                response.ok()
              );
            }),
            panel.getByRole("button", { name: variant.confirmLabel }).click(),
          ]);
          await waitForGatewayMethod(stack.requestLog, "node.invoke");
          await expect(panel.getByText("Last node action").first()).toBeVisible();
          await panel.getByText("Last node action").click();
          await expect(panel.getByText('"delivered": true').first()).toBeVisible();
          await panel.getByText("Last node action").scrollIntoViewIfNeeded();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("nodes-invoke-result.png"),
          });

          await panel.getByRole("button", { name: variant.pendingWorkButton }).click();
          await expect(
            panel.getByRole("alertdialog", { name: /Queue pending work\?/ }),
          ).toBeVisible();
          await Promise.all([
            page.waitForResponse((response) => {
              return (
                response.url().includes("/api/nodes") &&
                response.request().method() === "POST" &&
                response.ok()
              );
            }),
            panel.getByRole("button", { name: variant.confirmLabel }).click(),
          ]);
          await waitForGatewayMethod(stack.requestLog, "node.pending.enqueue");
          await expect(panel.getByText("pending-node-work-visual").first()).toBeVisible();
          await page.screenshot({
            fullPage: false,
            path: testInfo.outputPath("nodes-queue-result.png"),
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
