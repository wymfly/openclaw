import { expect, test, type Page } from "@playwright/test";
import { authHeaders, openDeck, startRealGatewayStack, type E2EStack } from "./helpers";

type JsonObject = Record<string, unknown>;

test.describe("api explorer real OpenClaw Gateway contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the API Explorer real Gateway E2E",
  );
  test.setTimeout(240_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    test.setTimeout(300_000);
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies describe, safe typed invocation, and typed allowlist error shapes", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);

    const describe = await request.get(`${stack.backendBase}/api/gateway/describe`, {
      headers,
    });
    expect(describe.ok(), `gateway.describe returned ${describe.status()}`).toBe(true);
    const describePayload = (await describe.json()) as {
      events?: JsonObject;
      methods?: JsonObject;
      untyped?: string[];
    };
    const methods = describePayload.methods ?? {};
    expect(Object.keys(methods).length).toBeGreaterThan(0);
    expect(methods["gateway.describe"] ?? methods["agents.list"]).toBeTruthy();

    const safeInvoke = await request.post(
      `${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`,
      {
        headers,
        data: { method: "gateway.describe", params: {}, timeoutMs: 10000 },
      },
    );
    expect(safeInvoke.ok(), `gateway.describe typed invoke returned ${safeInvoke.status()}`).toBe(
      true,
    );
    const safePayload = (await safeInvoke.json()) as { requestId?: string; result?: JsonObject };
    expect(typeof safePayload.requestId).toBe("string");
    expect(typeof safePayload.result).toBe("object");

    const invalidInvoke = await request.post(
      `${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`,
      {
        headers,
        data: { method: "__deck_go_e2e_invalid__", params: {} },
      },
    );
    expect(invalidInvoke.status()).toBe(400);
    await expect(invalidInvoke.json()).resolves.toMatchObject({
      error: { code: "INVALID_GATEWAY_METHOD" },
    });

    await testInfo.attach("api-explorer-real-contract-shape", {
      body: JSON.stringify(
        {
          describeEvents: Object.keys(describePayload.events ?? {}).length,
          describeMethods: Object.keys(methods).length,
          safeInvokeRequestId: safePayload.requestId,
          typedAllowlistErrorStatus: invalidInvoke.status(),
          untypedCount: describePayload.untyped?.length ?? 0,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  test("renders API Explorer UI against the real BFF without direct Gateway browser calls", async ({
    page,
  }) => {
    const unexpected = recordUnexpected(page, stack.backendBase);
    const directGatewayRequests: string[] = [];
    const directGatewaySockets: string[] = [];
    page.on("request", (request) => {
      if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
        directGatewayRequests.push(request.url());
      }
    });
    page.on("websocket", (websocket) => {
      if (stack.realGateway?.url && websocket.url().startsWith(stack.realGateway.url)) {
        directGatewaySockets.push(websocket.url());
      }
    });

    await openDeck(page, stack.frontendBase, "api-explorer", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    const panel = page.getByTestId("api-explorer-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Gateway API Explorer" })).toBeVisible();
    await expect(panel.getByText("Describe ready")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Methods" })).toBeVisible();

    await page.getByPlaceholder("method name or scope").fill("gateway.describe");
    await page.getByRole("treeitem", { name: /gateway\.describe/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(panel.locator(".api-explorer-panel__response-card")).toContainText("200");
    await expect(panel.locator(".api-explorer-panel__history")).toContainText("gateway.describe");

    await expect.poll(() => unexpected.slice()).toEqual([]);
    expect(directGatewayRequests).toEqual([]);
    expect(directGatewaySockets).toEqual([]);
  });
});

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    if (response.url().startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  return unexpected;
}
