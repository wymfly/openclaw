import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  startBundledStack,
  waitForGatewayMethod,
  type E2EStack,
} from "./helpers";

test.describe("docs mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders document workbench and local extraction/delete evidence states", async ({
    page,
    request,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);
    await seedDocs(request, stack);
    await waitForGatewayMethod(stack.requestLog, "chat.history");

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-rich",
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });
    const enDocsNav = page
      .locator(".deck-ui-rail")
      .getByRole("button", { exact: true, name: "Docs" });
    await enDocsNav.scrollIntoViewIfNeeded();
    await enDocsNav.click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "docs");

    await expect(page.getByTestId("docs-panel")).toBeVisible();
    await expect(page.getByText("Doc Hub").first()).toBeVisible();
    await expect(page.getByText("extracted from sessions").first()).toBeVisible();
    await expect(page.getByText("Docs ready").first()).toBeVisible();
    await expect(page.getByText("12 docs").first()).toBeVisible();
    await expect(page.getByText("Architecture overview - May 4 sync").first()).toBeVisible();
    await expect(page.getByText("Source").first()).toBeVisible();
    await expect(page.getByText("agent:main:visual").first()).toBeVisible();
    await expect(page.getByText("api").first()).toBeVisible();
    await expect(page.getByText("On this page").first()).toBeVisible();
    await expect(page.getByText("All keywords").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-workbench-ready.png"),
    });

    await page.getByPlaceholder("Search docs... (⌘K)").fill("does-not-exist");
    await expect(page.getByText("No docs match. Try fewer terms").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-no-match-state.png"),
    });

    await page.getByPlaceholder("Search docs... (⌘K)").fill("protocol");
    await expect(
      page.getByText("Gateway protocol generation - Apr 30 review").first(),
    ).toBeVisible();
    await page.getByText("Doc payload").click();
    await expect(page.getByText('"sourceSession": "agent:main:visual"').first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-payload-evidence.png"),
    });
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm delete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-delete-confirmation.png"),
    });

    await page
      .locator(".docs-panel__confirm")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page.getByRole("button", { name: "Extract from session" }).click();
    await expect(page.getByRole("dialog", { name: "Extract Docs" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-extract-popover.png"),
    });
    await page
      .getByRole("dialog", { name: "Extract Docs" })
      .getByRole("button", { name: "Cancel", exact: true })
      .click();

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
      deckVisualState: "chat-rich",
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    const docsNav = page
      .locator(".deck-ui-rail")
      .getByRole("button", { exact: true, name: "文档" });
    await docsNav.scrollIntoViewIfNeeded();
    await docsNav.click();
    await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "docs");
    const zhPanel = page.getByTestId("docs-panel");
    await expect(zhPanel.getByText("文档中心").first()).toBeVisible();
    await expect(zhPanel.getByText("文档就绪").first()).toBeVisible();
    await zhPanel.getByPlaceholder("搜索文档... (⌘K)").fill("protocol");
    await expect(zhPanel.locator(".docs-panel__search-list button").first()).toBeVisible();
    await zhPanel.locator(".docs-panel__search-list button").first().click();
    await zhPanel.getByText("文档载荷").click();
    await expect(zhPanel.getByText('"sourceSession": "agent:main:visual"').first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-zh-light-workbench.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function seedDocs(request: APIRequestContext, stack: E2EStack) {
  const response = await request.post(`${stack.backendBase}/api/docs/extract`, {
    data: { sessionKey: "agent:main:visual" },
    headers: authHeaders(stack.accessToken),
  });
  expect(response.ok(), `docs extract seed returned ${response.status()}`).toBe(true);
  const payload = (await response.json()) as { extracted?: number };
  expect(payload.extracted ?? 0).toBeGreaterThan(0);
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
