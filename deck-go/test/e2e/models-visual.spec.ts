import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("models mock provider/model config-control workbench", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("covers configured provider groups, usage policy, drawers, wizard, and delete guard", async ({
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
    await expect(panel.getByTestId("models-catalog-header")).toBeVisible();
    await expect(
      panel.getByTestId("models-catalog-header").getByRole("heading", { name: "Models" }),
    ).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Configured Providers" })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Model usage policy" })).toBeVisible();
    await expect(panel.getByText("Edited in Agents")).toBeVisible();
    await expect(panel.getByTestId("models-provider-library")).toHaveCount(0);
    await expect(panel.getByText("openai").first()).toBeVisible();
    await expect(panel.getByText("GPT-5.4").first()).toBeVisible();
    await page.screenshot({ fullPage: false, path: testInfo.outputPath("models-ready.png") });

    const openaiSection = panel.getByTestId("models-section-openai");
    await openaiSection.getByRole("button", { name: "Edit provider" }).click();
    await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();
    for (const tab of ["Overview", "Identity", "Networking", "Models", "Advanced"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Identity" }).click();
    await expect(page.getByTestId("provider-api-key").getByText("secret ref")).toBeVisible();
    await page.getByRole("radio", { name: "Set ref" }).check();
    await expect(page.getByLabel("Env secret id")).toBeVisible();
    await page.getByLabel("Edit provider").getByRole("button", { name: "Close" }).click();

    await panel.getByTestId("models-row-openai-gpt-5.4").getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: /Edit openai model/ })).toBeVisible();
    for (const tab of ["Overview", "Identity", "Capacity", "Cost", "Networking", "Advanced"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
    await page.getByRole("tab", { name: "Identity" }).click();
    await expect(page.getByText("text").first()).toBeVisible();
    await expect(page.getByText("image").first()).toBeVisible();
    await expect(page.getByText("audio").first()).toHaveCount(0);
    await page.getByRole("button", { name: "Close" }).click();

    await expect(panel.getByRole("button", { name: "Advanced raw editor" })).toHaveCount(0);
    await expect(page.locator("textarea[aria-label='openclaw.json models block']")).toHaveCount(0);

    await panel.getByRole("button", { name: "Add provider" }).click();
    await expect(page.getByRole("heading", { name: "Add provider" })).toBeVisible();
    await page.getByRole("button", { name: "Start blank custom provider" }).click();
    await page.getByLabel("Provider id").fill("typedmock");
    await page.getByLabel("Env secret id").fill("TYPEDMOCK_API_KEY");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("SecretRef: env:TYPEDMOCK_API_KEY")).toBeVisible();
    await page.getByRole("button", { name: "Create provider" }).click();
    await expect(panel.getByTestId("models-section-typedmock")).toBeVisible();

    await panel
      .getByTestId("models-section-typedmock")
      .getByRole("button", { name: "Check impact" })
      .click();
    await expect(page.getByRole("heading", { name: "Impact check" })).toBeVisible();
    await expect(page.getByText("No references found in current config.")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Confirmation text").fill("delete");
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(panel.getByTestId("models-section-typedmock")).toHaveCount(0);

    await expect.poll(() => unexpected.slice()).toEqual([]);
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
