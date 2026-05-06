import { expect, test, type Page } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

const GATEWAY_REAL_VARIANTS = [
  {
    activityTab: "Activity",
    batchTab: "Batch console",
    eventLabel: "Events",
    locale: "en" as const,
    navLabel: "Monitor",
    readLabel: "read",
    runBatchLabel: "Run batch",
    searchLabel: "Search",
    theme: "dark" as const,
    title: "Gateway control plane",
    throughput: "Throughput projection",
  },
  {
    activityTab: "活动",
    batchTab: "批量控制台",
    eventLabel: "事件",
    locale: "zh" as const,
    navLabel: "监控",
    readLabel: "读",
    runBatchLabel: "执行批量",
    searchLabel: "搜索",
    theme: "dark" as const,
    title: "Gateway 控制平面",
    throughput: "吞吐投影",
  },
  {
    activityTab: "Activity",
    batchTab: "Batch console",
    eventLabel: "Events",
    locale: "en" as const,
    navLabel: "Monitor",
    readLabel: "read",
    runBatchLabel: "Run batch",
    searchLabel: "Search",
    theme: "light" as const,
    title: "Gateway control plane",
    throughput: "Throughput projection",
  },
  {
    activityTab: "活动",
    batchTab: "批量控制台",
    eventLabel: "事件",
    locale: "zh" as const,
    navLabel: "监控",
    readLabel: "读",
    runBatchLabel: "执行批量",
    searchLabel: "搜索",
    theme: "light" as const,
    title: "Gateway 控制平面",
    throughput: "吞吐投影",
  },
];

test.describe("gateway real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the gateway real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(420_000);
    stack = await startRealGatewayStack(testInfo);
  }, 420_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Gateway route shapes, UI variants, BFF-only transport, and skipped-safe controls", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-gateway-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const routeEvidence: JsonObject = { runId };

    const runtime = await expectOkJson(
      await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers }),
      "/runtime/gateway",
    );
    expect(runtime.mode).toBe("bundled");
    routeEvidence.runtime = pickKeys(runtime, ["mode", "status", "health", "configured", "pid"]);

    const capabilities = await expectOkJson(
      await request.get(`${stack.backendBase}/api/runtime/capabilities`, { headers }),
      "/runtime/capabilities",
    );
    expect(capabilities.mode).toBe("bundled");
    expect(typeof capabilities.configured).toBe("boolean");
    routeEvidence.capabilities = pickKeys(capabilities, [
      "mode",
      "configured",
      "endpointMutable",
      "supervisorState",
    ]);

    const health = await expectOkJson(
      await request.get(`${stack.backendBase}/api/gateway/health`, { headers }),
      "/gateway/health",
    );
    expect(health.ok).not.toBe(false);
    routeEvidence.health = {
      agentCount: Array.isArray(health.agents) ? health.agents.length : null,
      channelCount: Object.keys(asRecord(health.channels, "gateway health channels")).length,
      durationType: typeof health.durationMs,
      ok: health.ok,
    };

    const status = await expectOkJson(
      await request.get(`${stack.backendBase}/api/gateway/status`, { headers }),
      "/gateway/status",
    );
    routeEvidence.status = {
      channelCount: Object.keys(asRecord(status.channels, "gateway status channels")).length,
      heartbeatType: typeof status.heartbeat,
      state: status.state,
    };

    const describe = await expectOkJson(
      await request.get(`${stack.backendBase}/api/gateway/describe`, { headers }),
      "/gateway/describe",
    );
    const methods = asRecord(describe.methods, "gateway.describe methods");
    expect(methods["gateway.describe"]).toBeTruthy();
    const events = asRecord(describe.events, "gateway.describe events");
    routeEvidence.describe = {
      events: Object.keys(events).length,
      hasGatewayDescribe: Boolean(methods["gateway.describe"]),
      methods: Object.keys(methods).length,
      untyped: Array.isArray(describe.untyped) ? describe.untyped.length : 0,
    };

    const batch = await expectOkJson(
      await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/batch`, {
        data: {
          calls: [
            {
              id: "describe",
              method: "gateway.describe",
              params: { includeSchemas: false },
            },
          ],
          options: { failFast: false, timeoutMs: 5000 },
        },
        headers,
      }),
      "/v1/runtimes/{runtimeId}/gateway/batch",
    );
    const batchResults = Array.isArray(batch.results)
      ? (batch.results as Array<{ id?: unknown; ok?: unknown }>)
      : [];
    expect(batch.runtimeId).toBe("rt_local");
    expect(batchResults[0]?.id).toBe("describe");
    expect(batchResults[0]?.ok).toBe(true);
    routeEvidence.readOnlyBatch = {
      ok: batchResults[0]?.ok,
      requestIdType: typeof batch.requestId,
      resultCount: batchResults.length,
      runtimeId: batch.runtimeId,
    };

    const activity = await expectOkJson(
      await request.get(`${stack.backendBase}/api/activity?limit=20`, { headers }),
      "/activity",
    );
    expect(Array.isArray(activity.events)).toBe(true);
    routeEvidence.activity = {
      emptyValid: (activity.events as unknown[]).length === 0,
      events: (activity.events as unknown[]).length,
      projection: "Deck event-bus projection",
    };

    const monitorRuns = await expectOkJson(
      await request.get(`${stack.backendBase}/api/monitor/runs?limit=20`, { headers }),
      "/monitor/runs",
    );
    expect(Array.isArray(monitorRuns.runs)).toBe(true);
    const runs = monitorRuns.runs as Array<{ runId?: unknown }>;

    const monitorStats = await expectOkJson(
      await request.get(`${stack.backendBase}/api/monitor/stats`, { headers }),
      "/monitor/stats",
    );
    expect(typeof monitorStats.totalRuns).toBe("number");
    expect(Array.isArray(monitorStats.topAgents)).toBe(true);
    routeEvidence.monitor = {
      emptyValid: runs.length === 0,
      runs: runs.length,
      stats: pickKeys(monitorStats, ["avgDurationMs", "todayRuns", "totalRuns"]),
    };

    const firstRunId = runs.find((run) => typeof run.runId === "string")?.runId;
    if (typeof firstRunId === "string") {
      const detail = await expectOkJson(
        await request.get(
          `${stack.backendBase}/api/monitor/runs/${encodeURIComponent(firstRunId)}`,
          { headers },
        ),
        "/monitor/runs/{runId}",
      );
      expect(Array.isArray(detail.events)).toBe(true);
      expect(typeof detail.summary).toBe("object");
      routeEvidence.monitorDetail = {
        events: (detail.events as unknown[]).length,
        runId: firstRunId,
        status: "selected-run-verified",
      };
    } else {
      routeEvidence.monitorDetail = "empty-valid: real stack exposed no monitor runs";
    }

    routeEvidence.skippedSafe = {
      lifecycleControls: "not exposed by Gateway panel",
      mutatingBatch:
        "not executed; gateway.batch can run mutating child methods and the panel filters operator.write/subscription/nested batch methods",
      remoteBatch:
        "not executed in bundled real-stack run; remote mode stays locked in unit coverage",
    };

    const uiEvidence: JsonObject[] = [];
    for (const variant of GATEWAY_REAL_VARIANTS) {
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

        const gatewayNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await gatewayNav.scrollIntoViewIfNeeded();
        await gatewayNav.click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "gateway",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("gateway-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.throughput })).toBeVisible();
        const gatewayDescribeRow = panel
          .locator(".describe-row")
          .filter({ hasText: "gateway.describe" })
          .first();
        await expect(gatewayDescribeRow).toBeVisible();
        await expect(
          panel.getByRole("heading", { name: /Runtime Gateway|运行时 Gateway/ }),
        ).toBeVisible();

        await panel.getByLabel(variant.searchLabel).fill("gateway.describe");
        await expect(gatewayDescribeRow).toBeVisible();
        await panel.getByRole("tab", { name: variant.readLabel, exact: true }).click();
        await panel.getByLabel(variant.searchLabel).fill("");
        await panel.getByRole("tab", { name: new RegExp(`^${variant.eventLabel}`) }).click();
        const eventRows = await panel.locator(".describe-row").count();
        if (eventRows === 0) {
          await expect(panel.getByText(/No entries match|没有匹配条目/)).toBeVisible();
        } else {
          await expect(panel.locator(".describe-row").first()).toBeVisible();
        }

        await panel.getByRole("tab", { name: new RegExp(variant.batchTab) }).click();
        await expect(panel.getByRole("heading", { name: variant.batchTab })).toBeVisible();
        await expect(panel.getByText(/Bundled-mode composer|仅在 bundled 模式下/)).toBeVisible();
        const runButton = panel.getByRole("button", { name: variant.runBatchLabel });
        await expect(runButton).toBeVisible();
        const batchExecuted = await runButton.isEnabled();
        if (batchExecuted) {
          await runButton.click();
          await expect(panel.getByText(/1 calls|1 调用/)).toBeVisible();
        } else {
          await expect(
            panel.getByText(/locked|锁定|No read-only methods|未暴露只读方法/).first(),
          ).toBeVisible();
        }

        await panel.getByRole("tab", { name: new RegExp(variant.activityTab) }).click();
        await expect(
          panel.getByRole("heading", { name: /Recent activity|最近活动/ }),
        ).toBeVisible();
        await expect(panel.getByText(/Total Runs|总运行数/).first()).toBeVisible();
        await expect(
          panel.getByRole("button", { name: /^(Start|Stop|Restart|启动|停止|重启)$/ }),
        ).toHaveCount(0);

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          activityRows: await panel.locator(".activity-row").count(),
          batchExecuted,
          directGateway,
          eventRows,
          locale: variant.locale,
          theme: variant.theme,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "gateway-real-product-surface",
      {
        routeEvidence,
        runId,
        scenarioId: "gateway.real.product-surface",
        status: "passed",
        uiEvidence,
      },
      testInfo,
    );
  });
});

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

function asRecord(value: unknown, label: string): JsonObject {
  if (value === undefined || value === null) {
    return {};
  }
  expect(typeof value, `${label} should be an object`).toBe("object");
  expect(Array.isArray(value), `${label} should not be an array`).toBe(false);
  return value as JsonObject;
}

function pickKeys(value: JsonObject, keys: string[]) {
  const picked: JsonObject = {};
  for (const key of keys) {
    if (key in value) {
      picked[key] = value[key];
    }
  }
  return picked;
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
    if (response.url().startsWith(`${backendBase}/api/`) && status >= 400) {
      unexpected.apiErrors.push(`response: ${status} ${response.url()}`);
    }
  });
  return unexpected;
}

function recordDirectGateway(page: Page, stack: E2EStack) {
  const direct = {
    requests: [] as string[],
    websockets: [] as string[],
  };
  page.on("request", (request) => {
    if (stack.realGateway?.url && request.url().startsWith(stack.realGateway.url)) {
      direct.requests.push(request.url());
    }
  });
  page.on("websocket", (websocket) => {
    const gatewayUrl = stack.realGateway?.url;
    const gatewayWebsocketUrl = gatewayUrl?.replace(/^http/i, "ws");
    if (
      (gatewayUrl && websocket.url().startsWith(gatewayUrl)) ||
      (gatewayWebsocketUrl && websocket.url().startsWith(gatewayWebsocketUrl))
    ) {
      direct.websockets.push(websocket.url());
    }
  });
  return direct;
}
