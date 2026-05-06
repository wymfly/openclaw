import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("approvals mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders approval operations workbench and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "approvals", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("approvals-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "exec.approvals.get");
    await waitForGatewayMethod(stack.requestLog, "exec.approval.list");
    await waitForGatewayMethod(stack.requestLog, "plugin.approval.list");
    await expect(page.getByRole("heading", { name: "Approvals & Security" })).toBeVisible();
    await expect(
      page
        .getByText("Security decisions, plugin requests, policy state, and live approval evidence.")
        .first(),
    ).toBeVisible();
    await expect(page.getByText("Approvals ready").first()).toBeVisible();
    await expect(page.getByText("npm test").first()).toBeVisible();
    await expect(page.getByText("pnpm build").first()).toBeVisible();
    await expect(page.getByText("Recent decisions").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("approvals-workbench-ready.png"),
    });

    await page.getByRole("tab", { name: /Plugin 1/ }).click();
    await expect(page.getByText("connect workspace").first()).toBeVisible();
    await expect(page.getByText("Plugin approval payload").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("approvals-plugin-surface.png"),
    });

    await page.getByRole("tab", { name: /Exec 2/ }).click();
    await page.getByRole("button", { name: /pnpm build/ }).click();
    await expect(page.getByText("run:mock:2").first()).toBeVisible();
    await page.getByRole("tab", { name: "Plan" }).click();
    await expect(page.getByText("Decision scope").first()).toBeVisible();
    await page.getByRole("button", { name: "Allow always" }).click();
    await waitForGatewayMethod(stack.requestLog, "exec.approval.resolve");
    await expect(page.getByText("Last approval action").first()).toBeVisible();
    await expect(page.getByText("allow always").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("approvals-decision-result.png"),
    });

    await page.getByRole("button", { name: "Approval policy editor" }).click();
    await expect(page.getByRole("dialog", { name: "Approval policy editor" })).toBeVisible();
    await page.getByLabel("new approval allowlist path").fill("/tmp/openclaw-main");
    await page.getByRole("button", { name: "Add path" }).click();
    await expect(
      page.locator(".approvals-panel__pill", { hasText: "/tmp/openclaw-main" }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save policy" }).click();
    await waitForGatewayMethod(stack.requestLog, "exec.approvals.set");
    await expect(page.getByText("Last approval action").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("approvals-policy-save.png"),
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
