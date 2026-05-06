import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("models mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders prototype-shaped model registry, detail tabs, and dialogs", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "models", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    const panel = page.getByTestId("models-panel");
    await expect(panel).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(panel.getByRole("heading", { name: "Models" })).toBeVisible();
    await expect(panel.getByText("Inspect runtime-configured models").first()).toBeVisible();
    await expect(panel.getByLabel("Search models")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Add from catalog" })).toBeVisible();
    await expect(panel.getByText("GPT-5.4").first()).toBeVisible();
    await expect(panel.getByText("Claude Sonnet 4.6").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-workbench-ready.png"),
    });

    await panel.getByLabel("Search models").fill("sonnet");
    await expect(panel.getByText("Claude Sonnet 4.6").first()).toBeVisible();
    await expect(panel.getByText("GPT-4o").first()).toBeHidden();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-list-filtered.png"),
    });

    await panel.getByText("Claude Sonnet 4.6").first().click();
    await expect(panel.getByRole("heading", { name: "Claude Sonnet 4.6" })).toBeVisible();
    for (const tab of ["Overview", "Limits", "Pricing", "Usage", "Auth", "Audit"]) {
      await expect(panel.getByRole("tab", { name: tab })).toBeVisible();
    }
    await expect(panel.getByRole("heading", { name: "Runtime snapshot" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-detail-overview.png"),
    });

    await clickDetailTab(panel, "Pricing", "Pricing and spend");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-detail-pricing.png"),
    });

    await clickDetailTab(panel, "Usage", "Usage pressure");
    await clickDetailTab(panel, "Auth", "Auth configuration");
    await expect(panel.getByRole("button", { name: "Configure auth" })).toBeVisible();
    await clickDetailTab(panel, "Audit", "Audit history");
    await expect(panel.getByText("No audit contract").first()).toBeVisible();

    await panel.getByRole("button", { name: "Models" }).click();
    await panel.getByRole("button", { name: "Add from catalog" }).click();
    await expect(page.getByRole("dialog", { name: "Add model from catalog" })).toBeVisible();
    await expect(page.getByRole("button", { name: /OpenAI Catalog/ })).toBeVisible();
    await page.getByRole("button", { name: /OpenAI Catalog/ }).click();
    await expect(page.getByRole("button", { name: /GPT-5.4 Mini/ })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-catalog-dialog.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function clickDetailTab(
  panel: ReturnType<Page["getByTestId"]>,
  tab: string,
  heading: string,
) {
  const tabButton = panel.getByRole("tab", { name: tab });
  await tabButton.click();
  await expect(tabButton).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("heading", { name: heading })).toBeVisible();
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
