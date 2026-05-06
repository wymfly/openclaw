import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type LogsTailPayload = {
  cursor?: unknown;
  lines?: unknown[];
  reset?: unknown;
};

test.describe("logs real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the logs real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    testInfo.setTimeout(420_000);
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies logs tail shape and stream reachability through the real stack BFF", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const activityEvidence = await triggerSafeLogActivity(request, stack, testInfo);
    const runId = stack.realE2E?.runId ?? "deckgo-e2e-logs";
    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
    await expect(runtime.json()).resolves.toMatchObject({ mode: "bundled" });

    const tail = await request.get(`${stack.backendBase}/api/logs?limit=10&maxBytes=65536`, {
      headers,
    });
    expect(tail.ok(), `/logs returned ${tail.status()}`).toBe(true);
    const payload = (await tail.json()) as LogsTailPayload;
    if (payload.cursor !== undefined) {
      expect(typeof payload.cursor).toBe("number");
    }
    if (payload.reset !== undefined) {
      expect(typeof payload.reset).toBe("boolean");
    }
    expect(payload.lines === undefined || Array.isArray(payload.lines)).toBe(true);
    for (const line of payload.lines ?? []) {
      expect(typeof line, `logs.tail lines must stay string rows: ${JSON.stringify(line)}`).toBe(
        "string",
      );
    }

    const streamEvidence = await readFirstStreamChunk(
      `${stack.backendBase}/api/logs/stream`,
      headers,
    );
    await testInfo.attach("logs-real-stream-first-chunk", {
      body: JSON.stringify(streamEvidence, null, 2),
      contentType: "application/json",
    });
    expect([200, "quiet-timeout"]).toContain(streamEvidence.status);
    if (streamEvidence.status === 200 && streamEvidence.chunk) {
      expect(
        streamEvidence.chunk.includes("event: log.") ||
          streamEvidence.chunk.includes(": heartbeat"),
      ).toBe(true);
    }
    await writeRealE2EScenarioEvidence(
      stack,
      "logs-api-safe-activity",
      {
        scenarioId: "logs-api-safe-activity",
        runId,
        status: streamEvidence.status === 200 ? "passed" : "empty-valid",
        safeActivity: activityEvidence,
        tail: {
          cursor: payload.cursor,
          lineCount: payload.lines?.length ?? 0,
          reset: payload.reset,
        },
        stream: streamEvidence,
      },
      testInfo,
    );
  });

  test("renders logs UI variants through shell navigation and safe child interactions", async ({
    browser,
    request,
  }, testInfo) => {
    const activityEvidence = await triggerSafeLogActivity(request, stack, testInfo);
    const runId = stack.realE2E?.runId ?? "deckgo-e2e-logs";
    const variants = [
      {
        clearAll: "Clear all",
        expectedEmpty: "No log lines yet.",
        expectedFilterEmpty: "No lines match these filters.",
        expectedTitle: "Log Viewer",
        freeTextLabel: "Free text filter",
        locale: "en" as const,
        navLabel: "Logs",
        pause: "Pause stream",
        preparedExport: "Prepared log export",
        resume: "Resume stream",
        tailReady: "Tail ready",
        theme: "dark" as const,
      },
      {
        clearAll: "清空全部",
        expectedEmpty: "暂无日志行。",
        expectedFilterEmpty: "没有日志行匹配当前过滤条件。",
        expectedTitle: "日志查看器",
        freeTextLabel: "全文过滤",
        locale: "zh" as const,
        navLabel: "日志",
        pause: "暂停流",
        preparedExport: "已准备日志导出",
        resume: "恢复流",
        tailReady: "尾部就绪",
        theme: "light" as const,
      },
    ];
    const uiEvidence: Array<Record<string, unknown>> = [];

    for (const variant of variants) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const unexpected = recordUnexpected(page, stack.backendBase, stack.realGateway?.url);
      try {
        await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
          locale: variant.locale,
          nav: "expanded",
          theme: variant.theme,
        });

        await page.getByRole("button", { exact: true, name: variant.navLabel }).click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "logs");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("logs-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.expectedTitle })).toBeVisible();
        await expect(panel.getByText(variant.tailReady)).toBeVisible();

        const rowCount = await panel.locator(".log-row:not(.log-row--header)").count();
        if (rowCount === 0) {
          await expect(panel.getByText(variant.expectedEmpty)).toBeVisible();
          await expect(
            panel.getByRole("heading", { name: /No line selected|未选择日志行/ }),
          ).toBeVisible();
        } else {
          const firstRow = panel.locator(".log-row:not(.log-row--header)").first();
          await expect(firstRow).toBeVisible();
          await firstRow.click();
          await expect(
            panel.getByRole("heading", { name: /Structured fields|结构化字段/ }),
          ).toBeVisible();
          await expect(panel.getByRole("heading", { name: /Raw line|原始日志行/ })).toBeVisible();
          await expect(
            panel.getByRole("button", { name: /Copy line|Copied|复制日志行|已复制/ }),
          ).toBeVisible();
        }

        const actionRow = panel.locator(".log-stream__action-row");
        await actionRow.getByRole("button", { name: variant.pause }).click();
        await expect(actionRow.getByRole("button", { name: variant.resume })).toBeVisible();
        await actionRow.getByRole("button", { name: variant.resume }).click();
        await expect(actionRow.getByRole("button", { name: variant.pause })).toBeVisible();

        await actionRow.getByRole("button", { name: /Prepare export|准备导出/ }).click();
        await expect(panel.getByText(variant.preparedExport)).toBeVisible();

        await panel.getByLabel(variant.freeTextLabel).fill(`deck-go-e2e-no-such-log-line-${runId}`);
        await expect(panel.locator(".log-row:not(.log-row--header)")).toHaveCount(0);
        await expect(panel.getByText(variant.expectedFilterEmpty)).toBeVisible();
        await panel.getByRole("button", { name: variant.clearAll }).click();
        await expect(panel.getByLabel(variant.freeTextLabel)).toHaveValue("");

        await actionRow.getByRole("button", { name: /Clear local logs|清空本地日志/ }).click();
        await expect(panel.getByText(variant.expectedEmpty)).toBeVisible();

        await expect.poll(() => unexpected.slice()).toEqual([]);
        uiEvidence.push({
          locale: variant.locale,
          rowCount,
          theme: variant.theme,
          status: "passed",
        });
      } finally {
        await context.close();
      }
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "logs-ui-product-surface",
      {
        scenarioId: "logs-ui-product-surface",
        runId,
        status: "passed",
        safeActivity: activityEvidence,
        variants: uiEvidence,
      },
      testInfo,
    );
  });
});

async function triggerSafeLogActivity(
  request: APIRequestContext,
  stack: E2EStack,
  testInfo: TestInfo,
) {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-logs";
  const headers = {
    ...authHeaders(stack.accessToken),
    "X-Deck-Go-E2E-Run-Id": runId,
  };
  const endpoints = [
    `${stack.backendBase}/api/runtime/gateway`,
    `${stack.backendBase}/api/gateway/describe?includeSchemas=false`,
    `${stack.backendBase}/api/activity?limit=5`,
    `${stack.backendBase}/api/logs?limit=3&maxBytes=65536`,
  ];
  const results: Array<{ ok: boolean; status: number; url: string }> = [];
  for (const url of endpoints) {
    const response = await request.get(url, { headers });
    results.push({ ok: response.ok(), status: response.status(), url: new URL(url).pathname });
  }
  const rpc = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
    headers,
    data: { method: "agents.list", params: {} },
  });
  results.push({
    ok: rpc.ok(),
    status: rpc.status(),
    url: "/api/v1/runtimes/rt_local/gateway/rpc#agents.list",
  });
  await testInfo.attach("logs-real-safe-activity", {
    body: JSON.stringify({ runId, results }, null, 2),
    contentType: "application/json",
  });
  return results;
}

async function readFirstStreamChunk(url: string, headers: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const reader = response.body?.getReader();
    if (!reader) {
      return { status: response.status, chunk: "" };
    }
    const first = await reader.read();
    controller.abort();
    return {
      status: response.status,
      chunk: first.value ? new TextDecoder().decode(first.value) : "",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "quiet-timeout" as const, chunk: "" };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function recordUnexpected(page: Page, backendBase: string, gatewayBase?: string) {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    if (gatewayBase && request.url().startsWith(gatewayBase)) {
      unexpected.push(`direct-gateway-request: ${request.method()} ${request.url()}`);
    }
  });
  page.on("websocket", (websocket) => {
    if (gatewayBase && websocket.url().startsWith(gatewayBase)) {
      unexpected.push(`direct-gateway-websocket: ${websocket.url()}`);
    }
  });
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
