import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type RouteEvidence = {
  body: string;
  label: string;
  ok: boolean;
  payload: JsonObject;
  status: number;
};
type ChannelsFixtureAttempt = {
  method: string;
  reason: string;
  removedChannels: string[];
  runId: string;
  status: "skipped-safe";
};

test.describe("channels real OpenClaw Gateway contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the channels real Gateway E2E",
  );
  test.setTimeout(300_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Channels API route shapes and records fixture safety", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const fixture = await recordChannelsFixtureAttempt(stack, testInfo);

    const runtime = await expectOkJson(
      await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers }),
      "runtime gateway",
    );
    expect(runtime.mode).toBe("bundled");

    const describe = await expectOkJson(
      await request.get(`${stack.backendBase}/api/gateway/describe`, {
        headers,
        params: { includeSchemas: "true" },
      }),
      "gateway describe",
    );
    const methods = asRecord(describe.methods ?? {}, "gateway describe methods");

    const typedStatus = await expectOkOrDegraded(
      request,
      stack,
      "typed channels.status",
      "POST",
      "/api/v1/runtimes/rt_local/gateway/rpc",
      { method: "channels.status", params: {} },
      [400, 404, 502, 503],
    );
    if (typedStatus.ok) {
      const result = asRecord(typedStatus.payload.result ?? {}, "channels.status result");
      expect(result).toHaveProperty("channelOrder");
      expect(result).toHaveProperty("channelAccounts");
    }

    const channels = await expectOkJson(
      await request.get(`${stack.backendBase}/api/channels`, { headers }),
      "/channels",
    );
    expect(channels).toHaveProperty("channelOrder");
    expect(channels).toHaveProperty("channelAccounts");
    const channelOrder = Array.isArray(channels.channelOrder) ? channels.channelOrder : [];
    const throughputChannel = typeof channelOrder[0] === "string" ? channelOrder[0] : "telegram";
    const throughput = await expectOkOrDegraded(
      request,
      stack,
      `GET /channels/${throughputChannel}/throughput`,
      "GET",
      `/api/channels/${encodeURIComponent(throughputChannel)}/throughput`,
      undefined,
      [400, 404, 502, 503],
    );
    if (throughput.ok) {
      expect(Array.isArray(throughput.payload.buckets ?? [])).toBe(true);
      expect(typeof (throughput.payload.messagesIn ?? 0)).toBe("number");
      expect(typeof (throughput.payload.messagesOut ?? 0)).toBe("number");
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "channels-api-fixture",
      {
        scenarioId: "channels-api-fixture",
        runId: fixture.runId,
        status: typedStatus.ok ? "passed" : "handoff-blocked",
        fixture,
        routeShapes: {
          channelCount: channelOrder.length,
          describeHasChannelsLogout: Object.prototype.hasOwnProperty.call(
            methods,
            "channels.logout",
          ),
          describeHasChannelsStatus: Object.prototype.hasOwnProperty.call(
            methods,
            "channels.status",
          ),
          throughput: { channel: throughputChannel, ok: throughput.ok, status: throughput.status },
          typedStatus: { ok: typedStatus.ok, status: typedStatus.status },
        },
        skippedSafe: [
          "channels.probe provider hook",
          "channels.logout provider session mutation",
          "channels.config.patch without disposable channel fixture",
        ],
      },
      testInfo,
    );
  });

  test("renders Channels UI variants through shell navigation", async ({ browser }, testInfo) => {
    const fixture = await recordChannelsFixtureAttempt(stack, testInfo);
    const variants = [
      {
        expectedTitle: "Channels",
        filter: "Enabled",
        locale: "en" as const,
        navLabel: "Channels",
        noRowsText: "No channels loaded.",
        refresh: "Refresh channels",
        search: "telegram",
        tabNames: ["Overview", "Throughput", "Probe", "Settings", "Routing"],
        theme: "dark" as const,
      },
      {
        expectedTitle: "渠道管理",
        filter: "已启用",
        locale: "zh" as const,
        navLabel: "渠道",
        noRowsText: "暂无渠道。",
        refresh: "刷新渠道",
        search: "telegram",
        tabNames: ["概览", "吞吐量", "探测", "设置", "路由"],
        theme: "light" as const,
      },
    ];
    const variantEvidence: JsonObject[] = [];

    for (const variant of variants) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = recordUnexpected(page, stack.backendBase);
      const directGateway = recordDirectGateway(page, stack);

      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        await page.getByRole("button", { exact: true, name: variant.navLabel }).click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "channels",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("channels-panel");
        await expect(panel.getByRole("heading", { name: variant.expectedTitle })).toBeVisible();
        await expect(panel.getByRole("button", { name: variant.refresh })).toBeVisible();

        await panel.getByPlaceholder(/Search|搜索/).fill(variant.search);
        await panel.getByRole("button", { name: variant.filter }).click();
        await panel.getByPlaceholder(/Search|搜索/).fill("");

        const rows = panel.locator(".row");
        const rowCount = await rows.count();
        const interactions = ["shell navigation", "theme/locale render", "search/filter"];
        if (rowCount > 0) {
          await rows.first().click();
          await expect(panel.locator(".detail-view")).toBeVisible();
          for (const tabName of variant.tabNames.slice(0, 3)) {
            await panel.getByRole("tab", { name: tabName }).click();
            await expect(panel.getByRole("tab", { name: tabName })).toHaveAttribute(
              "aria-selected",
              "true",
            );
          }
          const logoutButton = panel.getByRole("button", {
            name: variant.navLabel === "Channels" ? "Logout channel" : "断开渠道",
          });
          if (await logoutButton.isEnabled().catch(() => false)) {
            await logoutButton.click();
            await expect(page.getByRole("dialog")).toBeVisible();
            await page
              .getByRole("button", { name: variant.navLabel === "Channels" ? "Cancel" : "取消" })
              .click();
            interactions.push("logout dialog cancel");
          } else {
            interactions.push("logout skipped-safe disabled");
          }
          interactions.push("detail tabs");
        } else {
          await expect(panel.getByText(variant.noRowsText)).toBeVisible();
          await panel.getByRole("button", { name: variant.refresh }).click();
          await expect(panel.getByText(variant.noRowsText)).toBeVisible();
          interactions.push("empty-state refresh");
        }

        await expect.poll(() => unexpected.slice()).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        variantEvidence.push({
          locale: variant.locale,
          theme: variant.theme,
          rows: rowCount,
          interactions,
          directBrowserGatewayCalls: "none",
        });
      } finally {
        await context.close();
      }
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "channels-ui-variants",
      {
        scenarioId: "channels-ui-variants",
        runId: fixture.runId,
        status: "passed",
        fixture,
        variants: variantEvidence,
        skippedSafe: [
          "run-scoped provider channel creation",
          "probe provider hook",
          "logout provider session mutation",
          "channel config patch without disposable channel",
        ],
      },
      testInfo,
    );
  });
});

async function recordChannelsFixtureAttempt(
  stack: E2EStack,
  testInfo: TestInfo,
): Promise<ChannelsFixtureAttempt> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-channels-no-run-id";
  const removedChannels = stack.realE2E?.sanitizedConfig?.removedChannels ?? [];
  const attempt: ChannelsFixtureAttempt = {
    method: "isolated openclaw.json channel seed",
    reason:
      "The real E2E harness removes external channel accounts from the isolated config by default; no disposable provider-backed channel fixture is available, and config-only rows would not surface through channels.status without a provider plugin.",
    removedChannels,
    runId,
    status: "skipped-safe",
  };
  await writeRealE2EScenarioEvidence(
    stack,
    "channels-fixture-attempt",
    {
      ...attempt,
      scenarioId: "channels-fixture-attempt",
      status: "handoff-blocked",
      fixtureAttemptStatus: attempt.status,
      maxAttempts: 1,
      attempts: [
        {
          method: attempt.method,
          result: "skipped-safe",
          reason: attempt.reason,
        },
      ],
    },
    testInfo,
  );
  return attempt;
}

async function expectOkJson(
  response: { json: () => Promise<unknown>; ok: () => boolean; status: () => number },
  label: string,
) {
  expect(response.ok(), `${label} returned ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload).toBeTruthy();
  expect(typeof payload).toBe("object");
  return payload as JsonObject;
}

async function expectOkOrDegraded(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
  method: "GET" | "POST",
  path: string,
  data: JsonObject | undefined,
  degradedStatuses: number[],
): Promise<RouteEvidence> {
  const response = await request.fetch(`${stack.backendBase}${path}`, {
    data,
    headers: authHeaders(stack.accessToken),
    method,
  });
  const status = response.status();
  const body = await response.text();
  const payload = parseJsonObject(body);
  if (!response.ok()) {
    expect(degradedStatuses, `${label} degraded with ${status}`).toContain(status);
    return { body: body.slice(0, 2000), label, ok: false, payload, status };
  }
  return { body: body.slice(0, 2000), label, ok: true, payload, status };
}

function asRecord(value: unknown, label: string): JsonObject {
  expect(value, `${label} should be present`).toBeTruthy();
  expect(typeof value, `${label} should be an object`).toBe("object");
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as JsonObject;
}

function parseJsonObject(text: string): JsonObject {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : { raw: parsed };
  } catch {
    return { raw: text };
  }
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const requests: string[] = [];
  const websockets: string[] = [];
  const prefixes = directGatewayPrefixes(stack);
  page.on("request", (request) => {
    if (prefixes.some((prefix) => request.url().startsWith(prefix))) {
      requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    if (prefixes.some((prefix) => websocket.url().startsWith(prefix))) {
      websockets.push(websocket.url());
    }
  });
  return { requests, websockets };
}

function directGatewayPrefixes(stack: E2EStack) {
  if (!stack.realGateway?.url) {
    return [];
  }
  const url = new URL(stack.realGateway.url);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${wsProtocol}//${url.host}`];
}

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
    const url = response.url();
    if (url.startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.push(`response: ${status} ${url}`);
    }
  });
  return unexpected;
}
