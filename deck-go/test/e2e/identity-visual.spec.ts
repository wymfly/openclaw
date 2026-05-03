import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("identity mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders identity relationship workbench and guarded mutation states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "identity", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("identity-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "deck.identity.list");
    await expect(page.getByRole("heading", { name: "Identities" }).first()).toBeVisible();
    await expect(page.getByText("Relationship inventory").first()).toBeVisible();
    await expect(page.getByText("3 canonicals").first()).toBeVisible();
    await expect(page.getByText("4 peers").first()).toBeVisible();
    await expect(page.getByText("identity-hash-visual-1").first()).toBeVisible();
    await expect(page.getByText("Mutation safety").first()).toBeVisible();
    await expect(page.getByText("empty-review-slot").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("identity-workbench-ready.png"),
    });

    await page.getByText("Identity payload").click();
    await expect(page.getByText('"canonical": "main"').first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("identity-raw-payload.png"),
    });

    await page.getByRole("button", { name: /\+ Link Identity/ }).click();
    await expect(page.getByRole("form", { name: "Link Identity" })).toBeVisible();
    await page.getByLabel("identity canonical").fill(" reviewer ");
    await page.getByLabel("identity channel").fill(" telegram ");
    await page.getByLabel("identity peer id").fill(" tg-reviewer ");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("identity-link-dialog.png"),
    });

    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/deck/identity") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      page.getByRole("button", { name: "Save" }).click(),
    ]);
    await waitForGatewayMethod(stack.requestLog, "deck.identity.link");
    await expect(page.getByText("Linked telegram:tg-reviewer to reviewer.")).toBeVisible();
    await expect(page.getByText("identity-hash-visual-2").first()).toBeVisible();
    await expect(page.getByText("reviewer").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("identity-linked-state.png"),
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
