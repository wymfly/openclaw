import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("skills mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders prototype-shaped catalog, detail tabs, dialogs, hub, and matrix states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "skills", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    const panel = page.getByTestId("skills-panel");
    await expect(panel).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "skills.status");
    await waitForGatewayMethod(stack.requestLog, "skills.bins");
    await waitForGatewayMethod(stack.requestLog, "agents.list");
    await waitForGatewayMethod(stack.requestLog, "deck.agents.skills.get");
    await expect(panel.getByRole("heading", { name: "Skills" })).toBeVisible();
    await expect(panel.getByText("control / skill catalog")).toBeVisible();
    await expect(panel.getByText("PPP Generation")).toBeVisible();
    await expect(panel.getByText("Domain Research")).toBeVisible();
    await expect(panel.getByLabel("Search skills")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-workbench-ready.png"),
    });

    await panel.getByRole("button", { name: /Open GitHub detail/ }).click();
    await expect(panel.getByRole("heading", { name: "GitHub" })).toBeVisible();
    for (const tab of ["Overview", "Setup", "Triggers", "Bins", "Files", "Audit"]) {
      await panel.getByRole("tab", { name: tab }).click();
      await expect(panel.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    }
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-detail-tabs.png"),
    });

    await panel.getByRole("button", { name: "Configure" }).click();
    await expect(page.getByRole("dialog", { name: "Configure skill" })).toBeVisible();
    await page.getByRole("button", { name: "Save config" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.update");
    await expect(page.getByRole("dialog", { name: "Configure skill" })).toBeHidden();
    await expect(panel.getByText("Last skill action").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-config-save.png"),
    });

    await panel.getByRole("tab", { name: "Bins" }).click();
    await panel.getByRole("button", { name: "Install" }).first().click();
    await expect(page.getByRole("dialog", { name: "Install Skills" })).toBeVisible();
    await page
      .getByRole("dialog", { name: "Install Skills" })
      .getByRole("button", { name: "Install" })
      .click();
    await waitForGatewayMethod(stack.requestLog, "skills.install");

    await panel.locator("summary").filter({ hasText: "Agent skill matrix" }).click();
    await expect(panel.getByText("Builder Agent")).toBeVisible();
    await panel.getByRole("button", { name: /(Add|Remove) github for builder/ }).click();
    await waitForGatewayMethod(stack.requestLog, "deck.agents.skills.set");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-install-and-matrix.png"),
    });

    await panel.getByRole("button", { name: "Skills" }).click();
    await panel.getByRole("tab", { name: "Hub" }).click();
    await panel.getByLabel("Search skills").fill("git");
    await panel.getByRole("button", { name: "Search hub" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.search");
    await expect(panel.getByText("Git Helper")).toBeVisible();
    await panel.getByRole("button", { name: "Preview" }).first().click();
    await waitForGatewayMethod(stack.requestLog, "skills.detail");
    await expect(page.getByRole("dialog", { name: "Install skill from hub" })).toBeVisible();
    await expect(page.getByText("Version")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-clawhub-detail.png"),
    });
    await page.getByRole("button", { name: "Install from ClawHub" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.install");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-hub-install.png"),
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
