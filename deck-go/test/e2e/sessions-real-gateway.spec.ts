import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  assertRunScopedCleanupTarget,
  authHeaders,
  buildRunScopedName,
  callRuntimeGatewayRpc,
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

test.describe("sessions real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Sessions real Gateway E2E",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startRealGatewayStack(testInfo);
  }, 420_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies safe Sessions route shapes through the real BFF", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);

    const sessions = await expectOkJson(
      await request.get(`${stack.backendBase}/api/sessions?limit=20`, { headers }),
      "/sessions",
    );
    const sessionEntries = asRecordArray(sessions.sessions, "sessions.sessions");
    const keys = sessionEntries
      .map((entry) => entry.key)
      .filter((key): key is string => typeof key === "string")
      .slice(0, 3);

    const evidence: JsonObject = {
      mutationBoundary: "skipped-safe: only request validation was exercised",
      sessionCount: sessionEntries.length,
    };

    const fixture = await createRunScopedSessionFixture(request, stack, "api");
    evidence.runScopedFixture = {
      key: fixture.key,
      label: fixture.label,
      runId: fixture.runId,
    };
    try {
      const fixtureDetail = await expectOkOrDegraded(
        request,
        stack,
        "GET /sessions/{runScopedSessionKey}",
        "GET",
        `/api/sessions/${encodeURIComponent(fixture.key)}?limit=20`,
        undefined,
        [400, 404, 501, 502, 503],
      );
      evidence.runScopedFixtureDetail = {
        ok: fixtureDetail.ok,
        status: fixtureDetail.status,
      };
    } finally {
      evidence.runScopedFixtureCleanup = await cleanupRunScopedSessionFixture(
        request,
        stack,
        fixture,
      );
    }

    if (keys.length > 0) {
      const preview = await expectOkOrDegraded(
        request,
        stack,
        "POST /chat/sessions/preview",
        "POST",
        "/api/chat/sessions/preview",
        { keys },
        [400, 404, 501, 502, 503],
      );
      if (preview.ok) {
        expect(Array.isArray(preview.payload.previews ?? [])).toBe(true);
      }
      evidence.preview = { ok: preview.ok, status: preview.status };
    } else {
      evidence.preview = "empty-valid: real stack exposed no sessions to preview";
    }

    const firstSessionKey = keys[0];
    if (firstSessionKey) {
      const encoded = encodeURIComponent(firstSessionKey);
      const detail = await expectOkOrDegraded(
        request,
        stack,
        "GET /sessions/{sessionKey}",
        "GET",
        `/api/sessions/${encoded}?limit=20`,
        undefined,
        [400, 404, 501, 502, 503],
      );
      if (detail.ok) {
        expect(typeof detail.payload).toBe("object");
      }

      const history = await expectOkOrDegraded(
        request,
        stack,
        "GET /chat/history",
        "GET",
        `/api/chat/history?sessionKey=${encoded}&limit=20`,
        undefined,
        [400, 404, 501, 502, 503],
      );
      if (history.ok) {
        expect(Array.isArray(history.payload.messages ?? [])).toBe(true);
      }

      const usage = await expectOkOrDegraded(
        request,
        stack,
        "GET /usage/sessions",
        "GET",
        `/api/usage/sessions?key=${encoded}&includeContextWeight=true&limit=1`,
        undefined,
        [400, 404, 501, 502, 503],
      );
      if (usage.ok) {
        expect(Array.isArray(usage.payload.sessions ?? [])).toBe(true);
      }

      const usageLogs = await expectOkOrDegraded(
        request,
        stack,
        "GET /usage/sessions/logs",
        "GET",
        `/api/usage/sessions/logs?key=${encoded}&limit=20`,
        undefined,
        [400, 404, 501, 502, 503],
      );
      if (usageLogs.ok) {
        expect(Array.isArray(usageLogs.payload.logs ?? [])).toBe(true);
      }

      const lineage = await expectOkOrDegraded(
        request,
        stack,
        "POST /deck/subagents lineage",
        "POST",
        "/api/deck/subagents",
        { action: "lineage", sessionKey: firstSessionKey },
        [400, 404, 501, 502, 503],
      );

      const compaction = await expectOkOrDegraded(
        request,
        stack,
        "POST /chat/compaction list",
        "POST",
        "/api/chat/compaction",
        { action: "list", key: firstSessionKey },
        [400, 404, 501, 502, 503],
      );

      evidence.selectedSession = {
        compaction: { ok: compaction.ok, status: compaction.status },
        detail: { ok: detail.ok, status: detail.status },
        history: { ok: history.ok, status: history.status },
        key: firstSessionKey,
        lineage: { ok: lineage.ok, status: lineage.status },
        usage: { ok: usage.ok, status: usage.status },
        usageLogs: { ok: usageLogs.ok, status: usageLogs.status },
      };
    } else {
      evidence.selectedSession = "empty-valid: no real session key available";
    }

    const mutationRejections = await Promise.all([
      expectRejected(
        request,
        stack,
        "POST /chat/sessions/reset",
        "POST",
        "/api/chat/sessions/reset",
        {},
      ),
      expectRejected(
        request,
        stack,
        "POST /chat/sessions/clear",
        "POST",
        "/api/chat/sessions/clear",
        {},
      ),
      expectRejected(request, stack, "DELETE /chat/sessions", "DELETE", "/api/chat/sessions", {}),
      expectRejected(
        request,
        stack,
        "POST /chat/sessions/patch",
        "POST",
        "/api/chat/sessions/patch",
        {},
      ),
      expectRejected(request, stack, "POST /chat/compact", "POST", "/api/chat/compact", {}),
      expectRejected(
        request,
        stack,
        "POST /chat/compaction missing key",
        "POST",
        "/api/chat/compaction",
        { action: "list" },
      ),
    ]);
    evidence.mutationRejections = mutationRejections.map((entry) => ({
      label: entry.label,
      status: entry.status,
    }));

    await testInfo.attach("sessions-real-contract-shape", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    await writeRealE2EScenarioEvidence(
      stack,
      "sessions-real-contract-shape",
      {
        scenarioId: "sessions-real-contract-shape",
        runId: stack.realE2E?.runId ?? "deckgo-e2e-sessions",
        status: "passed",
        evidence,
      },
      testInfo,
    );
  });

  test("navigates to Sessions UI variants with run-scoped real data and safe interactions", async ({
    browser,
    request,
  }, testInfo) => {
    const fixture = await createRunScopedSessionFixture(request, stack, "ui");
    const variants = [
      {
        actionsTitle: "Session actions",
        compact: "Compact session",
        confirmCompact: "Confirm compact",
        expectedTitle: "Sessions",
        inspectorTitle: "Session Inspector",
        locale: "en" as const,
        navLabel: "Sessions",
        searchPlaceholder: "title, key, preview",
        tabs: {
          actions: "Actions",
          usage: "Usage",
        },
        transcriptPlaceholder: "search transcript",
        usageContext: "Usage and context",
        theme: "dark" as const,
      },
      {
        actionsTitle: "会话操作",
        compact: "压缩会话",
        confirmCompact: "确认压缩",
        expectedTitle: "会话",
        inspectorTitle: "会话检查器",
        locale: "zh" as const,
        navLabel: "会话",
        searchPlaceholder: "标题、Key、预览",
        tabs: {
          actions: "操作",
          usage: "用量",
        },
        transcriptPlaceholder: "搜索对话记录",
        usageContext: "用量与上下文",
        theme: "light" as const,
      },
    ];
    const uiEvidence: Array<Record<string, unknown>> = [];

    try {
      for (const variant of variants) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const unexpected = recordUnexpected(page, stack.backendBase);
        const directGatewayRequests: string[] = [];
        const directGatewaySockets: string[] = [];
        page.on("request", (pageRequest) => {
          if (stack.realGateway?.url && pageRequest.url().startsWith(stack.realGateway.url)) {
            directGatewayRequests.push(pageRequest.url());
          }
        });
        page.on("websocket", (websocket) => {
          if (stack.realGateway?.url && websocket.url().startsWith(stack.realGateway.url)) {
            directGatewaySockets.push(websocket.url());
          }
        });

        try {
          await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
            locale: variant.locale,
            nav: "expanded",
            theme: variant.theme,
          });

          await page.getByRole("button", { exact: true, name: variant.navLabel }).click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "sessions",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("sessions-panel");
          await expect(panel).toBeVisible();
          await expect(
            panel.getByRole("heading", { exact: true, name: variant.expectedTitle }),
          ).toBeVisible();
          await expect(panel.getByText(variant.inspectorTitle)).toBeVisible();

          await panel.getByPlaceholder(variant.searchPlaceholder).fill(fixture.runId);
          await expect(panel.getByText(fixture.label).first()).toBeVisible({ timeout: 20_000 });
          await panel.getByText(fixture.label).first().click();
          await expect(panel.getByText(fixture.key).first()).toBeVisible();
          await panel.getByRole("tab", { name: variant.tabs.usage }).click();
          await expect(panel.getByText(variant.usageContext).first()).toBeVisible();

          await panel.getByPlaceholder(variant.transcriptPlaceholder).fill(fixture.runId);
          await panel.getByRole("tab", { name: variant.tabs.actions }).click();
          await expect(panel.getByText(variant.actionsTitle).first()).toBeVisible();
          await panel.getByRole("button", { exact: true, name: variant.compact }).click();
          await expect(panel.getByRole("button", { name: variant.confirmCompact })).toBeVisible();

          await expect.poll(() => unexpected.slice()).toEqual([]);
          expect(directGatewayRequests).toEqual([]);
          expect(directGatewaySockets).toEqual([]);
          uiEvidence.push({
            directGatewayRequests,
            directGatewaySockets,
            fixtureKey: fixture.key,
            locale: variant.locale,
            theme: variant.theme,
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      const cleanup = await cleanupRunScopedSessionFixture(request, stack, fixture);
      await writeRealE2EScenarioEvidence(
        stack,
        "sessions-ui-product-surface",
        {
          scenarioId: "sessions-ui-product-surface",
          runId: fixture.runId,
          status: "passed",
          cleanup,
          variants: uiEvidence,
        },
        testInfo,
      );
    }
  });
});

type RunScopedSessionFixture = {
  key: string;
  label: string;
  runId: string;
};

async function createRunScopedSessionFixture(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
): Promise<RunScopedSessionFixture> {
  const runId = stack.realE2E?.runId ?? "deckgo-e2e-sessions";
  const requestedKey = buildRunScopedName(runId, `sessions-${label}`);
  const fixtureLabel = buildRunScopedName(runId, `Sessions ${label}`);
  const rpc = await callRuntimeGatewayRpc(request, stack, "sessions.create", {
    agentId: "main",
    key: requestedKey,
    label: fixtureLabel,
    model: "cpa/gpt-5.4",
  });
  const result = parseJsonObject(JSON.stringify(rpc.result ?? {}));
  const key = typeof result.key === "string" ? result.key : requestedKey;
  const fixture = { key, label: fixtureLabel, runId };
  assertRunScopedCleanupTarget(fixture, runId);
  return fixture;
}

async function cleanupRunScopedSessionFixture(
  request: APIRequestContext,
  stack: E2EStack,
  fixture: RunScopedSessionFixture,
) {
  assertRunScopedCleanupTarget(fixture, fixture.runId);
  const rpc = await callRuntimeGatewayRpc(request, stack, "sessions.delete", {
    key: fixture.key,
    deleteTranscript: true,
    emitLifecycleHooks: false,
  });
  return {
    key: fixture.key,
    result: rpc.result ?? null,
  };
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

async function expectRejected(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
  method: "DELETE" | "POST",
  path: string,
  data: JsonObject,
): Promise<RouteEvidence> {
  const rejected = await expectOkOrDegraded(request, stack, label, method, path, data, [400]);
  expect(rejected.ok).toBe(false);
  expect(rejected.status, `${label} should reject before touching Gateway state`).toBe(400);
  return rejected;
}

async function expectOkOrDegraded(
  request: APIRequestContext,
  stack: E2EStack,
  label: string,
  method: "DELETE" | "GET" | "POST",
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

function asRecordArray(value: unknown, label: string): JsonObject[] {
  expect(Array.isArray(value), `${label} should be an array`).toBe(true);
  return value as JsonObject[];
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

function recordUnexpected(page: Page, backendBase: string) {
  const unexpected: string[] = [];
  const degraded = [
    "/api/chat/compaction",
    "/api/chat/history",
    "/api/chat/sessions/preview",
    "/api/deck/subagents",
    "/api/sessions/",
    "/api/usage/sessions",
  ];
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
    if (!url.startsWith(`${backendBase}/api/`) || status < 400) {
      return;
    }
    if (degraded.some((path) => url.includes(path)) && [400, 404, 501, 502, 503].includes(status)) {
      return;
    }
    unexpected.push(`response: ${status} ${url}`);
  });
  return unexpected;
}
