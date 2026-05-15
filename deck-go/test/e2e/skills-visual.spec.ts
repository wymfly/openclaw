import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("skills mock product control-plane verification", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders product IA, guarded mutations, install wizard, and read-only agent usage", async ({
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
    await waitForGatewayMethod(stack.requestLog, "config.get");
    await waitForGatewayMethod(stack.requestLog, "deck.plugins.list");
    await waitForGatewayMethod(stack.requestLog, "plugin.approval.list");
    await expect(panel.getByRole("heading", { name: "Skills" })).toBeVisible();
    await expect(panel.getByText("control / skill catalog")).toBeVisible();
    await expect(panel.getByText("PPP Generation")).toBeVisible();
    await expect(panel.getByText("Domain Research")).toBeVisible();
    await expect(panel.getByLabel("Search skills")).toBeVisible();
    await expect(panel.getByRole("button", { name: /Approvals: \d+ pending/ })).toBeVisible();
    await expect(panel.getByText("unknown plugin")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-workbench-ready.png"),
    });

    await panel.getByRole("button", { name: "GitHub" }).click();
    await expect(panel.getByRole("heading", { name: "GitHub" })).toBeVisible();
    for (const section of [
      "Identity",
      "Source & activation",
      "API key",
      "env",
      "Eligibility health",
      "Agent Usage",
      "Owning Plugin",
      "Danger zone",
    ]) {
      await expect(panel.getByRole("heading", { name: section })).toBeVisible();
    }
    await expect(panel.getByText("API key configured")).toBeVisible();
    await expect(panel.getByText("gateway-rpc-missing").first()).toBeVisible();
    await expect(panel.getByRole("button", { name: "Open main in Agents" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Open ops in Agents" })).toBeVisible();
    await expect(
      panel.getByRole("button", { name: /Add GitHub|Remove GitHub|Save skills/ }),
    ).toHaveCount(0);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-product-detail.png"),
    });

    await panel.getByRole("button", { name: "Update API key" }).click();
    await expect(page.getByRole("dialog", { name: "Update API key" })).toBeVisible();
    await page.getByLabel("New API key").fill("__deck_test_apikey_mock_visual");
    await expect(page.getByText("__deck_test_apikey_mock_visual")).toHaveCount(0);
    await page.getByRole("button", { name: "Save API key" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.update");
    await expect(page.getByRole("dialog", { name: "Update API key" })).toBeHidden();

    await panel.getByRole("button", { name: "Edit env" }).click();
    await expect(page.getByRole("dialog", { name: "Edit env" })).toBeVisible();
    await page.getByLabel("Env key 1").fill("bad-key");
    await expect(page.getByText("Keys must match ^[A-Z][A-Z0-9_]*$")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save env" })).toBeDisabled();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-env-validation.png"),
    });
    await page.getByRole("button", { name: "Close" }).click();

    await panel.getByRole("button", { name: "Run install recipe" }).click();
    await expect(page.getByRole("dialog", { name: "Run install recipe" })).toBeVisible();
    await page.getByRole("button", { name: "Install GitHub CLI" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.install");
    await expect(page.getByRole("dialog", { name: "Run install recipe" })).toBeHidden();

    await panel.getByRole("button", { name: "Update all managed" }).click();
    await expect(page.getByRole("dialog", { name: "Update all managed" })).toContainText(
      "This updates all tracked ClawHub skills in this Gateway workspace.",
    );
    await page.getByRole("button", { name: "Confirm update all" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.update");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-update-all-managed.png"),
    });

    await panel.getByRole("button", { name: "Install from ClawHub" }).click();
    await expect(page.getByRole("dialog", { name: "Install from ClawHub" })).toBeVisible();
    await page.getByRole("button", { name: "Next: slug" }).click();
    await page.getByLabel("Skill slug").fill("git-helper");
    await page.getByRole("button", { name: "Preview slug" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.search");
    await waitForGatewayMethod(stack.requestLog, "skills.detail");
    await expect(page.getByText("Latest version: 1.0.0")).toBeVisible();
    await page.getByRole("button", { name: "Next: API key" }).click();
    await page.getByLabel("Optional install API key").fill("__deck_test_apikey_mock_install");
    await page.getByRole("button", { name: "Next: env" }).click();
    await page.getByLabel("Wizard env key 1").fill("GIT_TOKEN");
    await page.getByLabel("Wizard env value 1").fill("1");
    await page.getByRole("button", { name: "Review install" }).click();
    await expect(page.getByText("installSkillHub first, then updateSkill for setup")).toBeVisible();
    await expect(page.getByText("__deck_test_apikey_mock_install")).toHaveCount(0);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-install-wizard-review.png"),
    });
    await page.getByRole("button", { name: "Confirm install" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.install");
    await waitForGatewayMethod(stack.requestLog, "skills.update");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-hub-install.png"),
    });

    await openDeck(page, stack.frontendBase, "skills", stack.accessToken, {
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    const zhPanel = page.getByTestId("skills-panel");
    await expect(zhPanel.getByRole("heading", { name: "技能管理" })).toBeVisible();
    await zhPanel.getByRole("button", { name: "GitHub" }).click();
    await expect(zhPanel.getByRole("heading", { name: "身份" })).toBeVisible();
    await expect(zhPanel.getByRole("heading", { name: "危险区" })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-light-zh.png"),
    });

    const rawLog = await readFile(stack.requestLog, "utf8");
    expect(rawLog).not.toContain('"method":"deck.agents.skills.set"');
    expect(rawLog).not.toContain('"method":"skills.uninstall"');
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
