import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("agents mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders productized agents states with contract-shaped mock data", async ({
    browser,
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
      locale: "en",
      nav: "collapsed",
      theme: "dark",
    });

    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await expect(page.getByText("Main").first()).toBeVisible();
    await expect(page.getByText("Ops Runner").first()).toBeVisible();
    await expect(page.getByText("Protected").first()).toBeVisible();
    await expect(page.getByText("Default").first()).toBeVisible();

    await page.waitForTimeout(500);
    await page.locator('[data-agents-workbench="true"]').screenshot({
      path: testInfo.outputPath("agents-workbench-ready.png"),
    });

    await page.getByText("Main").first().click();
    await expect(page.getByLabel("Agent detail for Main")).toBeVisible();
    await expect(page.getByText("Overview").first()).toBeVisible();
    await expect(page.getByText(/protected system\/fallback agent/i).first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-protected-main-detail.png"),
    });

    await clickDetailTab(page, "Runtime");
    await expect(page.getByLabel("Guarded runtime fields")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-runtime-guarded.png"),
    });

    await clickDetailTab(page, "Skills");
    await expect(page.getByText("Legacy Browser")).toBeVisible();
    await expect(page.getByText(/ineligible/i).first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-many-skills.png"),
    });

    await page.getByRole("button", { name: "Back to list" }).click();
    await page.getByText("Ops Runner").first().click();
    await expect(page.getByLabel("Agent detail for Ops Runner")).toBeVisible();

    await clickDetailTab(page, "Subagents");
    await expect(page.getByText(/Gateway wildcard is active/i)).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-wildcard-subagents.png"),
    });

    await clickDetailTab(page, "Event streams");
    await expect(page.getByText("enterprise.audit.custom")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-unknown-event-streams.png"),
    });

    await clickDetailTab(page, "Danger zone");
    const deleteButton = page.getByRole("button", { name: "Delete agent" }).last();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();
    await expect(page.getByRole("dialog", { name: "Delete agent" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-delete-confirmation.png"),
    });
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "New agent" }).click();
    await expect(page.getByRole("dialog", { name: "Create agent" })).toBeVisible();
    await page.getByLabel("Name").fill("Visual Fixture Agent");
    await page.getByLabel("Emoji").fill("V");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Workspace").fill("/tmp/openclaw-visual-fixture");
    await page.getByRole("button", { name: "Next" }).click();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-create-review.png"),
    });

    await captureVariant(browser, stack, "light", "zh", testInfo.outputPath("agents-light-zh.png"));
    await captureListOverride(
      browser,
      stack,
      { result: { agents: [], defaultId: undefined, mainKey: "main" } },
      testInfo.outputPath("agents-empty.png"),
    );
    await captureListOverride(
      browser,
      stack,
      { error: { code: "mock_error", message: "visual agents list failure" } },
      testInfo.outputPath("agents-error.png"),
    );

    expect(unexpected).toEqual([]);
  });

  test("returns to agents from fresh Data Fabric cache without refetching the list", async ({
    page,
  }) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await page.getByRole("button", { exact: true, name: "Agents" }).click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "agents");
    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "agents.list");
    const firstListCount = await countGatewayMethod(stack.requestLog, "agents.list");

    await page.getByRole("button", { exact: true, name: "Chat" }).click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "chat");
    await page.getByRole("button", { exact: true, name: "Agents" }).click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "agents");
    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await expect(page.getByText("Ops Runner").first()).toBeVisible();

    const secondListCount = await countGatewayMethod(stack.requestLog, "agents.list");
    expect(secondListCount).toBe(firstListCount);
    expect(unexpected).toEqual([]);
  });
});

async function clickDetailTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name }).first();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function captureVariant(
  browser: Browser,
  stack: E2EStack,
  theme: "dark" | "light",
  locale: "en" | "zh",
  path: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const unexpected = collectUnexpectedErrors(page);
  try {
    await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
      locale,
      nav: "expanded",
      theme,
    });
    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({ fullPage: false, path });
    expect(unexpected).toEqual([]);
  } finally {
    await context.close();
  }
}

async function captureListOverride(
  browser: Browser,
  stack: E2EStack,
  envelope: Record<string, unknown>,
  path: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const unexpected = collectUnexpectedErrors(page);
  await page.route("**/api/v1/runtimes/rt_local/gateway/rpc", async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { method?: string } | null;
    if (payload?.method === "agents.list") {
      await route.fulfill({
        contentType: "application/json",
        status: envelope.error ? 500 : 200,
        body: JSON.stringify(envelope),
      });
      return;
    }
    await route.continue();
  });
  try {
    await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
      locale: "en",
      nav: "collapsed",
      theme: "dark",
    });
    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await page.screenshot({ fullPage: false, path });
    if (!envelope.error) {
      expect(unexpected).toEqual([]);
    }
  } finally {
    await context.close();
  }
}

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

async function countGatewayMethod(requestLog: string, method: string) {
  const raw = await readFile(requestLog, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      try {
        return (JSON.parse(line) as { method?: string }).method === method;
      } catch {
        return false;
      }
    }).length;
}
