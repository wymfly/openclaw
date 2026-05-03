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

  test("renders skill operations workbench and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "skills", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("skills-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "skills.status");
    await waitForGatewayMethod(stack.requestLog, "skills.bins");
    await waitForGatewayMethod(stack.requestLog, "agents.list");
    await waitForGatewayMethod(stack.requestLog, "deck.agents.skills.get");
    await expect(page.getByRole("heading", { name: "Skills" }).first()).toBeVisible();
    await expect(page.getByText("Skills ready").first()).toBeVisible();
    await expect(page.getByText("4 installed").first()).toBeVisible();
    await expect(page.getByText("GitHub").first()).toBeVisible();
    await expect(page.getByText("env: GITHUB_TOKEN").first()).toBeVisible();
    await expect(page.getByText("Frontend Design").first()).toBeVisible();
    await expect(page.getByText("Agent skill matrix").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-workbench-ready.png"),
    });

    await page.getByRole("button", { name: "Save config" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.update");
    await expect(page.getByText("Last skill action").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-config-save.png"),
    });

    await page.getByLabel("skill hub search").fill("git");
    await page.getByRole("button", { name: "Search hub" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.search");
    await expect(page.getByText("Git Helper").first()).toBeVisible();
    await page
      .getByRole("button", { name: /Git Helper/ })
      .first()
      .click();
    await waitForGatewayMethod(stack.requestLog, "skills.detail");
    await expect(page.getByText("Hub skill").first()).toBeVisible();
    await expect(page.getByText("Version: 1.0.0").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-clawhub-detail.png"),
    });

    await page.getByRole("button", { name: "Install from ClawHub" }).click();
    await waitForGatewayMethod(stack.requestLog, "skills.install");
    await expect(page.getByText("Last hub action").first()).toBeVisible();

    await page.getByRole("button", { name: /Remove github for builder/ }).click();
    await waitForGatewayMethod(stack.requestLog, "deck.agents.skills.set");
    await expect(page.getByText("Last matrix action").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("skills-hub-install-and-matrix.png"),
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
