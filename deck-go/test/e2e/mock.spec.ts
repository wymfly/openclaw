import { expect, test } from "@playwright/test";
import {
  createChatSession,
  openDeck,
  startLocalStack,
  startRemoteFirstRunStack,
  waitForGatewayMethod,
  waitForRemoteConfigured,
  type E2EStack,
} from "./helpers";

test.describe("local mock", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders local controls and routes chat through the mock Gateway", async ({
    page,
    request,
  }) => {
    await openDeck(page, stack.frontendBase, "settings");
    await page.getByRole("tab", { name: "Runtime" }).click();

    await expect(page.getByTestId("mode-badge")).toHaveText("Local");
    const endpoint = page.getByTestId("endpoint-section");
    await expect(endpoint).toBeVisible();
    await expect(endpoint.getByText("OpenClaw state").first()).toBeVisible();
    await expect(endpoint.getByRole("button", { name: "Save endpoint" })).toHaveCount(0);

    await openDeck(page, stack.frontendBase, "gateway");
    const runtimeFacts = page.locator(".gateway-runtime-facts");
    await expect(runtimeFacts.getByText(/running/i).first()).toBeVisible();
    await expect(runtimeFacts.getByText(/openclaw-gateway\./).first()).toBeVisible();

    await openDeck(page, stack.frontendBase, "chat");
    await createChatSession(request, stack.backendBase, "hello from local e2e");
    await waitForGatewayMethod(stack.requestLog, "sessions.create");
  });
});

test.describe("remote mock", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRemoteFirstRunStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("runs first-run setup through the UI and then routes chat to the remote Gateway", async ({
    page,
    request,
  }) => {
    await openDeck(page, stack.frontendBase, "gateway");

    await expect(page.getByTestId("mode-badge")).toHaveText("Remote setup");
    await expect(page.getByTestId("first-run-banner")).toBeVisible();
    await expect(page.getByTestId("empty-state-not-configured").first()).toBeVisible();
    await expect(page.locator('[role="alert"]')).toHaveCount(0);

    await page.getByTestId("first-run-banner-cta").click();
    await page.getByRole("tab", { name: "Runtime" }).click();
    const endpoint = page.getByTestId("endpoint-section");
    await expect(endpoint).toHaveAttribute("aria-expanded", "true");
    await endpoint.getByLabel("Endpoint URL").fill(stack.mockGateway?.url ?? "");
    await endpoint.getByLabel("Endpoint token").fill(stack.mockGateway?.token ?? "");
    await endpoint.getByRole("button", { name: "Save endpoint" }).click();

    await waitForRemoteConfigured(stack.backendBase);
    await expect(page.getByTestId("mode-badge")).toHaveText("Remote");
    await expect(page.getByTestId("first-run-banner")).toHaveCount(0);

    await openDeck(page, stack.frontendBase, "chat");
    await createChatSession(request, stack.backendBase, "hello from remote e2e");
    await waitForGatewayMethod(stack.requestLog, "sessions.create");
  });
});
