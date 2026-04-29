import { expect, test } from "@playwright/test";
import {
  openDeck,
  sendChatMessage,
  startBundledStack,
  waitForGatewayMethod,
  type E2EStack,
} from "./helpers";

test.describe("bundled runtime mode", () => {
  let stack: E2EStack;

  test.beforeAll(async (_, testInfo) => {
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders bundled-only controls and routes chat through the spawned Gateway", async ({
    page,
  }) => {
    await openDeck(page, stack.frontendBase, "settings");

    await expect(page.getByTestId("mode-badge")).toHaveText("Bundled");
    const endpoint = page.getByTestId("endpoint-section");
    await expect(endpoint).toBeVisible();
    await expect(endpoint.getByText("set via .env").first()).toBeVisible();
    await expect(endpoint.getByRole("button", { name: "Save endpoint" })).toHaveCount(0);

    await openDeck(page, stack.frontendBase, "gateway");
    await page.getByRole("tab", { name: "Runtime" }).click();
    await expect(page.getByText(/pid:/).first()).toBeVisible();
    await expect(page.getByText(/owner/).first()).toBeVisible();

    await openDeck(page, stack.frontendBase, "chat");
    await sendChatMessage(page, "hello from bundled e2e");
    await waitForGatewayMethod(stack.requestLog, "sessions.create");
  });
});
