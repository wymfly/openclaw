import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("nodes mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders node operations workbench and guarded dynamic action states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);
    page.on("dialog", (dialog) => dialog.accept());

    await openDeck(page, stack.frontendBase, "nodes", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("nodes-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "node.list");
    await waitForGatewayMethod(stack.requestLog, "node.pair.list");
    await waitForGatewayMethod(stack.requestLog, "node.describe");
    await expect(page.getByRole("heading", { name: "Nodes" }).first()).toBeVisible();
    await expect(page.getByText("Nodes ready").first()).toBeVisible();
    await expect(page.getByText("3 nodes").first()).toBeVisible();
    await expect(page.getByText("2 pending").first()).toBeVisible();
    await expect(page.getByText("Alpha Control Mac").first()).toBeVisible();
    await expect(page.getByText("Beta Field Node").first()).toBeVisible();
    await expect(page.getByText("Invoke node command").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("nodes-workbench-ready.png"),
    });

    await page.locator("button").filter({ hasText: "pair-beta-repair" }).click();
    await expect(page.getByText("Repair requested").first()).toBeVisible();
    await expect(page.getByText("Review the repair request").first()).toBeVisible();
    await expect(page.getByText("shell: denied").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("nodes-pairing-repair-state.png"),
    });

    await page.getByLabel("Node invoke params JSON").fill('{"message":"mock visual probe"}');
    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/nodes") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      page.getByRole("button", { name: "Invoke command" }).click(),
    ]);
    await waitForGatewayMethod(stack.requestLog, "node.invoke");
    await expect(page.getByText("Last node action").first()).toBeVisible();
    await page.getByText("Last node action").click();
    await expect(page.getByText('"delivered": true').first()).toBeVisible();
    await page.getByText("Last node action").scrollIntoViewIfNeeded();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("nodes-invoke-result.png"),
    });

    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/nodes") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      page.getByRole("button", { name: "Queue pending work" }).click(),
    ]);
    await waitForGatewayMethod(stack.requestLog, "node.pending.enqueue");
    await expect(page.getByText("pending-node-work-visual").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("nodes-queue-result.png"),
    });

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
