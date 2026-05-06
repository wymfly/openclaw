import http from "node:http";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import {
  authHeaders,
  createWebhookFixture,
  deleteWebhookFixture,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
  type WebhookFixture,
} from "./helpers";

type JsonObject = Record<string, unknown>;

type Variant = {
  addWebhook: string;
  cancel: string;
  deliveries: string;
  deleteWebhook: string;
  navLabel: string;
  ready: RegExp;
  searchPlaceholder: string;
  testDelivery: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    addWebhook: "New Webhook",
    cancel: "Cancel",
    deliveries: "Deliveries",
    deleteWebhook: "Delete Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks ready/,
    searchPlaceholder: "name, url, id, or event",
    testDelivery: "Test Delivery",
    theme: "dark",
    locale: "en",
    title: "Webhooks",
  },
  {
    addWebhook: "新建 Webhook",
    cancel: "取消",
    deliveries: "投递",
    deleteWebhook: "删除 Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks.*就绪/,
    searchPlaceholder: "名称、URL、ID 或事件",
    testDelivery: "测试投递",
    theme: "dark",
    locale: "zh",
    title: "Webhook",
  },
  {
    addWebhook: "New Webhook",
    cancel: "Cancel",
    deliveries: "Deliveries",
    deleteWebhook: "Delete Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks ready/,
    searchPlaceholder: "name, url, id, or event",
    testDelivery: "Test Delivery",
    theme: "light",
    locale: "en",
    title: "Webhooks",
  },
  {
    addWebhook: "新建 Webhook",
    cancel: "取消",
    deliveries: "投递",
    deleteWebhook: "删除 Webhook",
    navLabel: "Webhooks",
    ready: /Webhooks.*就绪/,
    searchPlaceholder: "名称、URL、ID 或事件",
    testDelivery: "测试投递",
    theme: "light",
    locale: "zh",
    title: "Webhook",
  },
];

test.describe("webhooks real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Webhooks real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    receiver = await startReceiver();
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
    await receiver?.stop();
  });

  test("verifies route shapes, run-scoped CRUD/test/delete, UI variants, and BFF-only transport", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId = stack.realE2E?.runId ?? "real-webhooks";
    const routeEvidence: JsonObject = { runId };
    let fixture: WebhookFixture | undefined;
    let patchedName = "";

    try {
      const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
      expect(runtime.ok(), `/runtime/gateway returned ${runtime.status()}`).toBe(true);
      routeEvidence.runtime = await responseShape(runtime);

      fixture = await createWebhookFixture(request, stack, "webhook-real", {
        events: ["alert.fired", "test.ping"],
        secret: "ui-secret",
        url: receiver.url,
      });
      patchedName = `${fixture.name} patched`;
      routeEvidence.fixture = { id: fixture.id, name: fixture.name };

      const listed = await request.get(`${stack.backendBase}/api/webhooks`, { headers });
      expect(listed.ok(), `/webhooks list returned ${listed.status()}`).toBe(true);
      const listedShape = await responseShape(listed);
      const listedRows = Array.isArray(listedShape.payload?.webhooks)
        ? (listedShape.payload.webhooks as Array<{ id?: unknown; secret?: unknown }>)
        : [];
      const listedWebhook = listedRows.find((webhook) => webhook.id === fixture?.id);
      expect(listedWebhook?.secret).toBe("***redacted");
      routeEvidence.list = {
        ...listedShape,
        rowCount: listedRows.length,
        secretReadShape: listedWebhook?.secret,
      };

      const patched = await request.patch(
        `${stack.backendBase}/api/webhooks/${encodeURIComponent(fixture.id)}`,
        {
          headers,
          data: { enabled: false, name: patchedName },
        },
      );
      expect(patched.ok(), `/webhooks patch returned ${patched.status()}`).toBe(true);
      const patchedShape = await responseShape(patched);
      expect(patchedShape.payload).toMatchObject({
        enabled: false,
        id: fixture.id,
        name: patchedName,
        secret: "***redacted",
      });
      routeEvidence.patch = patchedShape;

      const tested = await request.post(
        `${stack.backendBase}/api/webhooks/${encodeURIComponent(fixture.id)}/test`,
        { headers },
      );
      expect(tested.ok(), `/webhooks test returned ${tested.status()}`).toBe(true);
      const testedShape = await responseShape(tested);
      expect(testedShape.payload).toMatchObject({ statusCode: 200, success: true });
      expect(typeof testedShape.payload?.deliveryId).toBe("string");
      await expect.poll(() => receiver.requests.length, { timeout: 10_000 }).toBeGreaterThan(0);
      routeEvidence.testDelivery = {
        ...testedShape,
        receiverRequests: receiver.requests.length,
      };

      const deliveries = await request.get(
        `${stack.backendBase}/api/webhooks/${encodeURIComponent(fixture.id)}/deliveries`,
        { headers },
      );
      expect(deliveries.ok(), `/webhooks deliveries returned ${deliveries.status()}`).toBe(true);
      const deliveriesShape = await responseShape(deliveries);
      const deliveryRows = Array.isArray(deliveriesShape.payload?.deliveries)
        ? deliveriesShape.payload.deliveries
        : [];
      expect(deliveryRows[0]).toMatchObject({
        eventType: "test.ping",
        success: true,
        webhookId: fixture.id,
      });
      routeEvidence.deliveries = {
        ...deliveriesShape,
        rowCount: deliveryRows.length,
      };

      const missingDelete = await request.delete(
        `${stack.backendBase}/api/webhooks/__deck_go_missing_webhook__`,
        { headers },
      );
      expect(missingDelete.status()).toBe(404);
      routeEvidence.missingDelete = await responseShape(missingDelete);

      const uiEvidence: JsonObject[] = [];
      for (const variant of VARIANTS) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const unexpected = recordUnexpected(page, stack.backendBase);
        const directGateway = collectDirectGateway(page, stack);

        try {
          await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
            locale: variant.locale,
            nav: "expanded",
            theme: variant.theme,
          });

          const webhooksNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await webhooksNav.scrollIntoViewIfNeeded();
          await webhooksNav.click();

          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "webhooks",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("webhooks-panel");
          await expect(panel).toBeVisible();
          await expect(panel.getByRole("heading", { name: variant.title }).first()).toBeVisible();
          await expect(panel.getByText(variant.ready).first()).toBeVisible();
          await expect(panel.getByText(patchedName).first()).toBeVisible();
          await panel.getByRole("button", { name: new RegExp(escapeRegExp(patchedName)) }).click();
          await expect(panel.getByText(/redacted|已脱敏/).first()).toBeVisible();

          await panel.getByPlaceholder(variant.searchPlaceholder).fill(patchedName);
          await expect(panel.locator(".webhooks-panel__list > li")).toHaveCount(1);
          await panel.getByPlaceholder(variant.searchPlaceholder).fill("");

          await panel.getByRole("button", { exact: true, name: variant.deliveries }).click();
          await expect(panel.getByRole("button", { name: /test\.ping/ }).first()).toBeVisible();
          await panel
            .getByRole("button", { name: /test\.ping/ })
            .first()
            .click();
          await expect(panel.getByText(/Payload|载荷/).first()).toBeVisible();

          if (variant.theme === "dark" && variant.locale === "en") {
            await panel.getByRole("button", { name: variant.testDelivery }).click();
            await expect(panel.getByText("Last webhook action").first()).toBeVisible();
            await expect
              .poll(() => receiver.requests.length, { timeout: 10_000 })
              .toBeGreaterThanOrEqual(2);
          }

          await panel.getByRole("button", { name: variant.deleteWebhook }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);

          await panel.getByRole("button", { name: variant.addWebhook }).click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: variant.cancel })
            .first()
            .click();
          await expect(page.getByRole("dialog")).toHaveCount(0);

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          uiEvidence.push({
            directGateway,
            locale: variant.locale,
            navigation: "chat-to-webhooks",
            receiverRequests: receiver.requests.length,
            theme: variant.theme,
            unexpected,
          });
        } finally {
          await context.close();
        }
      }

      const cleanup = await request.delete(
        `${stack.backendBase}/api/webhooks/${encodeURIComponent(fixture.id)}`,
        { headers },
      );
      expect(cleanup.ok(), `/webhooks cleanup returned ${cleanup.status()}`).toBe(true);
      routeEvidence.cleanup = await responseShape(cleanup);
      fixture = undefined;

      const evidence: JsonObject = {
        routeEvidence,
        runId,
        scenarioId: "webhooks.real.product-surface",
        status: "passed",
        unsupported: {
          auditTimeline: "skipped-safe: no audit route",
          eventCatalog: "skipped-safe: event catalog is frontend-local",
          livePush: "skipped-safe: no webhook.delivery push contract",
          platformDispatch: "skipped-safe: manual test.ping is the verified contract",
          retryMutation: "skipped-safe: no retry mutation route",
          stats: "skipped-safe: no stats route",
        },
        uiEvidence,
      };
      await writeRealE2EScenarioEvidence(
        stack,
        "webhooks-real-product-surface",
        evidence,
        testInfo,
      );
    } finally {
      if (fixture) {
        await deleteWebhookFixture(request, stack, fixture);
      }
    }
  });
});

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

async function responseShape(response: APIResponse): Promise<{
  keys: string[];
  payload?: JsonObject;
  status: number;
}> {
  const text = await response.text();
  let payload: JsonObject | undefined;
  try {
    const parsed = text ? JSON.parse(text) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as JsonObject;
    }
  } catch {
    payload = { raw: text.slice(0, 400) };
  }
  return {
    keys: payload ? Object.keys(payload).toSorted() : [],
    payload,
    status: response.status(),
  };
}

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected = {
    apiErrors: [] as string[],
    consoleErrors: [] as string[],
    pageErrors: [] as string[],
  };
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.consoleErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.pageErrors.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}

function collectDirectGateway(page: Page, stack: E2EStack) {
  const directGateway = {
    requests: [] as string[],
    websockets: [] as string[],
  };
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      directGateway.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (stack.realGateway?.url && websocket.url().startsWith(stack.realGateway.url)) {
      directGateway.websockets.push(websocket.url());
    }
  });
  return directGateway;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
