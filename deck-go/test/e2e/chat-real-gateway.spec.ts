import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  authHeaders,
  buildRunScopedName,
  isRunScopedValue,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type ChatFixture = {
  key: string;
  label: string;
  message: string;
  payload: JsonObject;
  runId?: string;
};

test.describe("chat real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the chat real Gateway E2E",
  );
  test.setTimeout(600_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(600_000);
    stack = await startRealGatewayStack(testInfo);
  }, 600_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("verifies Chat route shapes, run-scoped session fixture, UI variants, and cleanup", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ?? `deckgo-e2e-chat-w${testInfo.workerIndex}-r${testInfo.retry}`;
    const routeEvidence: JsonObject = { attempts: [], runId };
    const uiEvidence: JsonObject[] = [];
    let fixture: ChatFixture | null = null;

    try {
      routeEvidence.runtime = await expectOkJson(
        request,
        "GET",
        `${stack.backendBase}/api/runtime/gateway`,
        headers,
      );

      routeEvidence.initialSessions = await expectOkJson(
        request,
        "GET",
        `${stack.backendBase}/api/sessions?limit=20`,
        headers,
      );

      fixture = await createRunScopedChatFixture(request, stack, runId, headers, routeEvidence);

      if (fixture) {
        routeEvidence.snapshot = await expectOkJson(
          request,
          "GET",
          `${stack.backendBase}/api/chat/snapshot?sessionKey=${encodeURIComponent(fixture.key)}&agentId=main&limit=20`,
          headers,
        );
        routeEvidence.history = await expectOkJson(
          request,
          "GET",
          `${stack.backendBase}/api/chat/history?sessionKey=${encodeURIComponent(fixture.key)}&limit=20`,
          headers,
        );
        routeEvidence.preview = await expectOkJson(
          request,
          "POST",
          `${stack.backendBase}/api/chat/sessions/preview`,
          headers,
          { keys: [fixture.key] },
        );
        routeEvidence.subscribe = await expectOkJson(
          request,
          "POST",
          `${stack.backendBase}/api/chat/session-events`,
          headers,
          { action: "subscribe", sessionKey: fixture.key },
        );
        routeEvidence.unsubscribe = await expectOkJson(
          request,
          "POST",
          `${stack.backendBase}/api/chat/session-events`,
          headers,
          { action: "unsubscribe", sessionKey: fixture.key },
        );
      }

      routeEvidence.commands = await expectOkJson(
        request,
        "POST",
        `${stack.backendBase}/api/deck/commands/discover`,
        headers,
        { agentId: "main" },
      );
      routeEvidence.stream = await streamReachability(stack, headers);

      for (const variant of [
        {
          artifactLabel: "Artifact panel",
          canvasLabel: "Canvas panel",
          locale: "en" as const,
          navLabel: "Chat",
          placeholder: "Type a message...",
          searchSessions: "Search sessions...",
          searchTranscript: "Search messages...",
          theme: "dark" as const,
        },
        {
          artifactLabel: "工件面板",
          canvasLabel: "画布面板",
          locale: "zh" as const,
          navLabel: "对话",
          placeholder: "输入消息...",
          searchSessions: "搜索会话...",
          searchTranscript: "搜索对话...",
          theme: "dark" as const,
        },
        {
          artifactLabel: "Artifact panel",
          canvasLabel: "Canvas panel",
          locale: "en" as const,
          navLabel: "Chat",
          placeholder: "Type a message...",
          searchSessions: "Search sessions...",
          searchTranscript: "Search messages...",
          theme: "light" as const,
        },
        {
          artifactLabel: "工件面板",
          canvasLabel: "画布面板",
          locale: "zh" as const,
          navLabel: "对话",
          placeholder: "输入消息...",
          searchSessions: "搜索会话...",
          searchTranscript: "搜索对话...",
          theme: "light" as const,
        },
      ]) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const unexpected = recordUnexpected(page, stack.backendBase);
        const directGateway = recordDirectGateway(page, stack);

        try {
          await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
            locale: variant.locale,
            nav: "expanded",
            theme: variant.theme,
          });

          const chatNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await chatNav.scrollIntoViewIfNeeded();
          await chatNav.click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "chat");
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);
          await expect(page.getByLabel("Chat workspace")).toBeVisible();
          await expect(page.locator(".ds-session-sidebar")).toBeVisible();
          await expect(page.locator(".ds-chat-shell__transcript")).toBeVisible();
          await expect(page.locator("textarea")).toHaveAttribute(
            "placeholder",
            variant.placeholder,
          );
          if (fixture) {
            await expect(page.locator("[data-active-session]").first()).toHaveAttribute(
              "data-active-session",
              fixture.key,
              { timeout: 20_000 },
            );
          }

          const sessionSearch = page.getByPlaceholder(variant.searchSessions);
          await sessionSearch.fill(fixture ? fixture.label : "main");
          await expect(sessionSearch).toHaveValue(fixture ? fixture.label : "main");
          await page.getByPlaceholder(variant.searchSessions).fill("");

          await page.locator(".ds-chat-context-bar__search-btn").click();
          await expect(page.getByPlaceholder(variant.searchTranscript)).toBeVisible();
          const transcriptSearch = page.getByPlaceholder(variant.searchTranscript);
          await transcriptSearch.fill(fixture ? "Gateway" : "main");
          await expect(transcriptSearch).toHaveValue(fixture ? "Gateway" : "main");

          const canvasPanel = page.locator('[data-right-panel-mode="canvas"]');
          await expect(page.getByRole("button", { name: variant.canvasLabel })).toBeVisible();
          if (!(await canvasPanel.isVisible().catch(() => false))) {
            await page.getByRole("button", { name: variant.canvasLabel }).click();
          }
          await expect(canvasPanel).toBeVisible();
          await expect(page.getByRole("button", { name: variant.artifactLabel })).toBeVisible();

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);

          uiEvidence.push({
            fixture: fixture?.label ?? null,
            locale: variant.locale,
            nav: "agents -> chat",
            surfaces: [
              "session-sidebar",
              "transcript",
              "composer",
              "session-search",
              "transcript-search",
              "canvas-toggle",
              "artifact-toggle",
            ],
            activeSessionKey: fixture?.key ?? null,
            uiFixtureVisibleByRawRunId: false,
            theme: variant.theme,
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      routeEvidence.cleanup = fixture
        ? await cleanupRunScopedChatFixture(request, stack, fixture, runId, headers)
        : { status: "skipped", reason: "no run-scoped fixture was created" };
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "chat-real-product-surface",
      {
        cleanup: routeEvidence.cleanup,
        fixture: fixture
          ? {
              key: fixture.key,
              label: fixture.label,
              runId: fixture.runId,
            }
          : null,
        routeEvidence,
        runId,
        scenarioId: "chat.real.product-surface",
        status: fixture ? "passed" : "handoff-blocked",
        attempts: routeEvidence.attempts,
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function createRunScopedChatFixture(
  request: APIRequestContext,
  stack: E2EStack,
  runId: string,
  headers: Record<string, string>,
  routeEvidence: JsonObject,
): Promise<ChatFixture | null> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const label = buildRunScopedName(runId, `chat-real-${attempt}`);
    const message = `deck-go Chat real E2E fixture ${runId} attempt ${attempt}. Reply with a short acknowledgement.`;
    const response = await request.post(`${stack.backendBase}/api/chat/sessions/create`, {
      data: {
        agentId: "main",
        label,
        message,
        model: "gpt-5.4",
      },
      headers,
    });
    const payload = await jsonShape(response);
    (routeEvidence.attempts as unknown[]).push({
      label,
      payload,
      status: response.status(),
    });
    if (!response.ok()) {
      continue;
    }
    const key = readString(payload.key) ?? readString(payload.sessionKey);
    if (!key) {
      continue;
    }
    const runIdFromPayload = readString(payload.runId);
    if (runIdFromPayload) {
      routeEvidence.abort = await requestJson(
        request,
        "POST",
        `${stack.backendBase}/api/chat/abort`,
        headers,
        { runId: runIdFromPayload, sessionKey: key },
      );
    }
    return {
      key,
      label,
      message,
      payload,
      runId: runIdFromPayload,
    };
  }
  routeEvidence.fixtureStatus = "handoff-blocked";
  return null;
}

async function cleanupRunScopedChatFixture(
  request: APIRequestContext,
  stack: E2EStack,
  fixture: ChatFixture,
  runId: string,
  headers: Record<string, string>,
) {
  if (!isRunScopedValue([fixture.label, fixture.message, fixture.payload], runId)) {
    return {
      key: fixture.key,
      label: fixture.label,
      status: "refused",
      reason: "fixture did not contain current run id",
    };
  }
  const deleted = await request.delete(`${stack.backendBase}/api/chat/sessions`, {
    data: { sessionKey: fixture.key },
    headers,
  });
  return {
    key: fixture.key,
    label: fixture.label,
    payload: await jsonShape(deleted),
    status: deleted.ok() ? "deleted" : "degraded",
    statusCode: deleted.status(),
  };
}

async function expectOkJson(
  request: APIRequestContext,
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string>,
  data?: unknown,
) {
  const payload = await requestJson(request, method, url, headers, data);
  expect(payload.ok, `${method} ${url} returned ${payload.status}`).toBe(true);
  return payload;
}

async function requestJson(
  request: APIRequestContext,
  method: "GET" | "POST",
  url: string,
  headers: Record<string, string>,
  data?: unknown,
) {
  const response =
    method === "GET"
      ? await request.get(url, { headers })
      : await request.post(url, { data, headers });
  const payload = await jsonShape(response);
  return {
    keys: Object.keys(payload),
    ok: response.ok(),
    payload,
    status: response.status(),
  };
}

async function streamReachability(stack: E2EStack, headers: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`${stack.backendBase}/api/stream`, {
      headers,
      signal: controller.signal,
    });
    await response.body?.cancel();
    return {
      ok: response.ok,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function jsonShape(response: { json: () => Promise<unknown>; status: () => number }) {
  try {
    const payload = await response.json();
    return typeof payload === "object" && payload !== null
      ? (payload as JsonObject)
      : { value: payload };
  } catch {
    return { status: response.status() };
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
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
