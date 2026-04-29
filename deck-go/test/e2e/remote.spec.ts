import { expect, test } from "@playwright/test";
import {
  openDeck,
  sendChatMessage,
  startRemoteFirstRunStack,
  waitForGatewayMethod,
  waitForRemoteConfigured,
  type E2EStack,
} from "./helpers";

test.describe("remote runtime mode", () => {
  let stack: E2EStack;

  test.beforeAll(async (_, testInfo) => {
    stack = await startRemoteFirstRunStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("runs first-run setup through the UI and then routes chat to the remote Gateway", async ({
    page,
  }) => {
    await openDeck(page, stack.frontendBase, "gateway");

    await expect(page.getByTestId("mode-badge")).toHaveText("Remote setup");
    await expect(page.getByTestId("first-run-banner")).toBeVisible();
    await expect(page.getByTestId("empty-state-not-configured").first()).toBeVisible();
    await expect(page.locator('[role="alert"]')).toHaveCount(0);

    await page.getByTestId("first-run-banner-cta").click();
    const endpoint = page.getByTestId("endpoint-section");
    await expect(endpoint).toHaveAttribute("aria-expanded", "true");
    await endpoint.getByLabel("Endpoint URL").fill(stack.mockGateway?.url ?? "");
    await endpoint.getByLabel("Endpoint token").fill(stack.mockGateway?.token ?? "");
    await endpoint.getByRole("button", { name: "Save endpoint" }).click();

    await waitForRemoteConfigured(stack.backendBase);
    await expect(page.getByTestId("mode-badge")).toHaveText("Remote");
    await expect(page.getByTestId("first-run-banner")).toHaveCount(0);

    await openDeck(page, stack.frontendBase, "chat");
    await sendChatMessage(page, "hello from remote e2e");
    await waitForGatewayMethod(stack.requestLog, "sessions.create");
  });
});
