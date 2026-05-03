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

    await openDeck(page, stack.frontendBase, "docs", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("docs-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Doc Hub" }).first()).toBeVisible();
    await expect(page.getByText("Docs ready").first()).toBeVisible();
    await expect(page.getByText("1 docs").first()).toBeVisible();
    await expect(page.getByText("Deck-local docs registry").first()).toBeVisible();
    await expect(page.getByText("Docs Contract Chain Field Guide").first()).toBeVisible();
    await expect(page.getByText("Source session").first()).toBeVisible();
    await expect(page.getByText("agent:main:visual").first()).toBeVisible();
    await expect(page.getByText("api").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-workbench-ready.png"),
    });

    await page.getByPlaceholder("Search docs...").fill("does-not-exist");
    await expect(page.getByText("No docs match filters.").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-no-match-state.png"),
    });

    await page.getByPlaceholder("Search docs...").fill("localstore");
    await expect(page.getByText("Docs Contract Chain Field Guide").first()).toBeVisible();
    await page.getByText("Doc payload").click();
    await expect(page.getByText('"sourceSession": "agent:main:visual"').first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-payload-evidence.png"),
    });

    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: "Confirm delete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel delete" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("docs-delete-confirmation.png"),
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
