import http from "node:http";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("webhooks mock visual handoff alignment", () => {
  let stack: E2EStack;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;

  test.beforeAll(async ({ request }, testInfo) => {
    receiver = await startReceiver();
    stack = await startBundledStack(testInfo);
    await seedWebhooks(request, stack.backendBase, receiver.url);
  });

  test.afterAll(async () => {
    await stack?.stop();
    await receiver?.stop();
  });

  test("renders receiver workbench and local delivery interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "webhooks", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("webhooks-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Webhooks" }).first()).toBeVisible();
    await expect(
      page
        .getByText(
          "Webhook receivers, delivery evidence, event subscriptions, and guarded operations.",
        )
        .first(),
    ).toBeVisible();
    await expect(page.getByText("old Deck")).toHaveCount(0);
    await expect(page.getByText("Webhooks ready").first()).toBeVisible();
    await expect(page.getByText("Security incident receiver").first()).toBeVisible();
    await expect(page.getByText("Usage limit receiver").first()).toBeVisible();
    await expect(page.getByText("test.ping").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("webhooks-workbench-ready.png"),
    });

    await page.getByRole("button", { name: /Usage limit receiver/ }).click();
    await expect(page.getByText("https://hooks.example.test/usage").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("webhooks-selected-switch.png"),
    });

    await page.getByRole("button", { name: /Security incident receiver/ }).click();
    await page.getByRole("button", { name: "Edit Webhook" }).click();
    await expect(page.getByLabel("webhook name")).toHaveValue("Security incident receiver");
    await page.getByRole("button", { name: "budget.warn" }).click();
    await expect(page.getByLabel("webhook events")).toHaveValue(
      "alert.fired, approval.pending, budget.warn",
    );
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("webhooks-edit-events.png"),
    });

    await page.getByRole("button", { name: "Test Delivery" }).click();
    await expect(page.getByText("Last webhook action").first()).toBeVisible();
    await expect
      .poll(() => receiver.requests.length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("webhooks-test-delivery-result.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

async function seedWebhooks(request: APIRequestContext, backendBase: string, receiverUrl: string) {
  const security = await createWebhook(request, backendBase, {
    enabled: true,
    events: ["alert.fired", "approval.pending"],
    name: "Security incident receiver",
    secret: "visual-secret",
    url: receiverUrl,
  });
  await createWebhook(request, backendBase, {
    enabled: false,
    events: ["usage.limit", "budget.over"],
    name: "Usage limit receiver",
    url: "https://hooks.example.test/usage",
  });
  const testResponse = await request.post(`${backendBase}/api/webhooks/${security.id}/test`);
  expect(testResponse.ok(), `webhook test seed returned ${testResponse.status()}`).toBe(true);
}

async function createWebhook(
  request: APIRequestContext,
  backendBase: string,
  body: {
    enabled: boolean;
    events: string[];
    name: string;
    secret?: string;
    url: string;
  },
) {
  const response = await request.post(`${backendBase}/api/webhooks`, { data: body });
  expect(response.ok(), `webhook seed returned ${response.status()}`).toBe(true);
  return (await response.json()) as { id: string };
}

async function startReceiver() {
  const requests: string[] = [];
  const server = http.createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    requests.push(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("receiver did not bind to a TCP port");
  }
  return {
    requests,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    url: `http://127.0.0.1:${address.port}/webhook`,
  };
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
