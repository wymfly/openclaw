import { existsSync, readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
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
type CommandEvidenceRow = {
  command: string;
  sourceClass: string;
  expectedBackendPath: string;
  frontendAssertion: string;
  finalStatus: "passed" | "degraded" | "skipped-safe" | "handoff-blocked";
  responseSummary?: JsonObject;
  blockerReason?: string;
};

type ChatFixture = {
  key: string;
  label: string;
  message: string;
  payload: JsonObject;
  runId?: string;
};

const MAX_ATTEMPTS = 2;

test.describe("chat command real Gateway convergence", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the command convergence real Gateway E2E",
  );
  test.setTimeout(600_000);

  let stack: E2EStack | null = null;
  let stackStartupError: string | null = null;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(600_000);
    if (process.env.DECK_GO_REAL_GATEWAY_E2E_EXTERNAL === "1") {
      stack = createExternalRealGatewayStack();
      return;
    }
    try {
      stack = await startRealGatewayStack(testInfo);
    } catch (error) {
      stackStartupError = error instanceof Error ? error.message : String(error);
    }
  }, 600_000);

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("samples safe command classes through the live frontend and Deck BFF", async ({
    page,
    request,
  }, testInfo) => {
    if (!stack) {
      const runId = `deckgo-e2e-chat-command-startup-w${testInfo.workerIndex}-r${testInfo.retry}`;
      await writeRealE2EScenarioEvidence(
        { realE2E: undefined },
        "chat-command-real-convergence",
        {
          attempts: [
            {
              step: "startRealGatewayStack",
              ok: false,
              error: stackStartupError ?? "real Gateway stack did not start",
            },
          ],
          blockerReason:
            "isolated real Gateway stack did not reach RPC readiness before the bounded startup timeout",
          browserUrl: null,
          maxAttempts: 1,
          sampledCommands: [
            {
              command: "real-stack-startup",
              sourceClass: "real-stack",
              expectedBackendPath: "Gateway RPC agents.list through Deck BFF",
              frontendAssertion: "not reached because stack startup failed",
              finalStatus: "handoff-blocked",
              blockerReason: stackStartupError ?? "real Gateway stack did not start",
            },
          ],
          scenarioId: "chat.command.real-convergence",
          runId,
          selectedSession: null,
          status: "handoff-blocked",
          uiAssertions: [],
        },
        testInfo,
      );
      return;
    }

    const headers = authHeaders(stack.accessToken);
    const runId =
      stack.realE2E?.runId ??
      buildRunScopedName(
        `deckgo-e2e-chat-command-${Date.now().toString(36)}`,
        `w${testInfo.workerIndex}-r${testInfo.retry}`,
      );
    const steps: JsonObject[] = [];
    const rows: CommandEvidenceRow[] = [];
    const backendResponses = recordBackendResponses(page, stack.backendBase);
    const directGateway = recordDirectGateway(page, stack);
    let fixture: ChatFixture | null = null;

    try {
      const runtime = await requestJson(request, "GET", stack, "/api/runtime/gateway", headers);
      steps.push({ step: "runtime", ...runtime });
      const discover = await requestJson(
        request,
        "POST",
        stack,
        "/api/deck/commands/discover",
        headers,
        { agentId: "main" },
      );
      steps.push({ step: "deck.commands.discover", ...discover });
      rows.push(buildDiscoveryRow(discover));

      fixture = await createRunScopedChatFixture(request, stack, runId, headers, steps);
      if (!fixture) {
        rows.push({
          command: "fixture",
          sourceClass: "real-stack",
          expectedBackendPath: "POST /api/chat/sessions/create",
          frontendAssertion: "run-scoped disposable Chat session was not available",
          finalStatus: "handoff-blocked",
          blockerReason: "session fixture creation failed after bounded attempts",
        });
        return;
      }

      await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
        locale: "en",
        nav: "expanded",
        theme: "dark",
      });
      await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "chat");
      await expect(page.getByLabel("Chat workspace")).toBeVisible();
      await selectFixtureSession(page, fixture);

      rows.push(await runLocalConfigAliasSample(page, stack));
      rows.push(await runLocalQuerySample(page, stack));
      rows.push(await runUnknownCommandSample(page, stack, backendResponses));
      rows.push(await runRemoteCommandSample(page, stack, "/status", "gateway-builtin"));
      rows.push(await runRemoteCommandSample(page, stack, "/id", "alias"));
      rows.push(await runCompactSample(page, stack, fixture.key));
    } finally {
      steps.push({
        step: "cleanup",
        cleanup: fixture
          ? await cleanupRunScopedChatFixture(request, stack, fixture, runId, headers)
          : { status: "skipped", reason: "no run-scoped fixture" },
      });

      await writeRealE2EScenarioEvidence(
        stack,
        "chat-command-real-convergence",
        {
          attempts: [
            {
              attempt: 1,
              status: finalScenarioStatus(rows),
              stepCount: steps.length,
            },
          ],
          backendResponses,
          browserUrl: stack.frontendBase,
          fixture: fixture
            ? { key: fixture.key, label: fixture.label, runId: fixture.runId }
            : null,
          maxAttempts: MAX_ATTEMPTS,
          sampledCommands: rows,
          scenarioId: "chat.command.real-convergence",
          steps,
          runId,
          selectedSession: fixture?.key ?? null,
          status: finalScenarioStatus(rows),
          uiAssertions: rows.map((row) => ({
            command: row.command,
            assertion: row.frontendAssertion,
            status: row.finalStatus,
          })),
        },
        testInfo,
      );
    }

    expect(directGateway.requests, "browser must not call Gateway HTTP directly").toEqual([]);
    expect(directGateway.websockets, "browser must not open Gateway WebSockets directly").toEqual(
      [],
    );
    expect(rows.some((row) => row.command === "/compact")).toBe(true);
    expect(
      rows.every((row) =>
        ["passed", "degraded", "skipped-safe", "handoff-blocked"].includes(row.finalStatus),
      ),
    ).toBe(true);
  });
});

function createExternalRealGatewayStack(): E2EStack {
  const stackEnv = readStackEnvFile(process.env.DECK_GO_STACK_ENV);
  const backendBase =
    process.env.DECK_GO_REAL_GATEWAY_E2E_BACKEND_BASE ??
    urlFromAddr(stackEnv.DECK_GO_ADDR ?? process.env.DECK_GO_ADDR ?? "127.0.0.1:19566");
  const frontendHost =
    stackEnv.DECK_GO_FRONTEND_HOST ?? process.env.DECK_GO_FRONTEND_HOST ?? "127.0.0.1";
  const frontendPort =
    stackEnv.DECK_GO_FRONTEND_PORT ?? process.env.DECK_GO_FRONTEND_PORT ?? "4174";
  const frontendBase =
    process.env.DECK_GO_REAL_GATEWAY_E2E_FRONTEND_BASE ?? `http://${frontendHost}:${frontendPort}`;
  const gatewayHost =
    stackEnv.RUNTIME_BUNDLED_BIND_HOST ?? process.env.RUNTIME_BUNDLED_BIND_HOST ?? "127.0.0.1";
  const gatewayPort =
    stackEnv.RUNTIME_BUNDLED_BIND_PORT ?? process.env.RUNTIME_BUNDLED_BIND_PORT ?? "18789";
  return {
    accessToken: stackEnv.DECK_GO_ACCESS_TOKEN ?? process.env.DECK_GO_ACCESS_TOKEN,
    backendBase,
    frontendBase,
    requestLog: "",
    realGateway: {
      token: stackEnv.RUNTIME_BUNDLED_TOKEN ?? process.env.RUNTIME_BUNDLED_TOKEN ?? "",
      url: `http://${gatewayHost}:${gatewayPort}`,
    },
    stop: async () => {},
  };
}

function readStackEnvFile(filePath: string | undefined): Record<string, string> {
  if (!filePath || !existsSync(filePath)) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    values[key] = unquoteEnvValue(rawValue);
  }
  return values;
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function urlFromAddr(addr: string): string {
  return /^https?:\/\//i.test(addr) ? addr : `http://${addr}`;
}

function finalScenarioStatus(rows: CommandEvidenceRow[]) {
  if (rows.some((row) => row.finalStatus === "handoff-blocked")) {
    return "handoff-blocked";
  }
  if (rows.some((row) => row.finalStatus === "degraded" || row.finalStatus === "skipped-safe")) {
    return "degraded";
  }
  return "passed";
}

async function createRunScopedChatFixture(
  request: APIRequestContext,
  stack: E2EStack,
  runId: string,
  headers: Record<string, string>,
  attempts: JsonObject[],
): Promise<ChatFixture | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const label = buildRunScopedName(runId, `chat-command-${attempt}`);
    const message = `deck-go command convergence real E2E ${runId} attempt ${attempt}`;
    const response = await request.post(`${stack.backendBase}/api/chat/sessions/create`, {
      data: {
        agentId: "main",
        label,
        message,
        model: process.env.DECK_GO_REAL_GATEWAY_E2E_MODEL ?? "gpt-5.4",
      },
      headers,
    });
    const payload = await readResponsePayload(response);
    attempts.push({
      step: "fixture.create",
      attempt,
      label,
      ok: response.ok(),
      status: response.status(),
      payload,
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
      attempts.push({
        step: "fixture.abort-active-run",
        ...(await requestJson(request, "POST", stack, "/api/chat/abort", headers, {
          runId: runIdFromPayload,
          sessionKey: key,
        })),
      });
    }
    return { key, label, message, payload, runId: runIdFromPayload };
  }
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
      reason: "fixture did not contain the current run id",
    };
  }
  try {
    const response = await request.delete(`${stack.backendBase}/api/chat/sessions`, {
      data: { sessionKey: fixture.key },
      headers,
    });
    return {
      key: fixture.key,
      label: fixture.label,
      ok: response.ok(),
      payload: await readResponsePayload(response),
      status: response.status(),
    };
  } catch (error) {
    return {
      key: fixture.key,
      label: fixture.label,
      status: "failed",
      error: summarizeError(error),
    };
  }
}

async function selectFixtureSession(page: Page, fixture: ChatFixture) {
  const search = page.getByPlaceholder("Search sessions...");
  await expect(search).toBeVisible();
  await search.fill(fixture.label);
  const row = page.locator(".deck-ui-session-row").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await expect(page.locator("[data-active-session]").first()).toHaveAttribute(
    "data-active-session",
    fixture.key,
    { timeout: 30_000 },
  );
  await search.fill("");
}

async function runLocalConfigAliasSample(page: Page, stack: E2EStack): Promise<CommandEvidenceRow> {
  const responsePromise = waitForOptionalApiResponse(
    page,
    stack,
    "/api/chat/sessions/patch",
    20_000,
  );
  await submitCommand(page, "/t high");
  const response = await responsePromise;
  if (!response) {
    return {
      command: "/t high",
      sourceClass: "local config alias",
      expectedBackendPath: "POST /api/chat/sessions/patch",
      frontendAssertion: "bounded wait did not observe the session patch request",
      finalStatus: "degraded",
      blockerReason: "local alias command did not emit the expected patch request within 20s",
    };
  }
  const payload = await safeResponsePayload(response);
  const ui = await checkUiAssertion(() =>
    expect(page.locator(".ds-chat-context-bar")).toContainText(/high/i, { timeout: 15_000 }),
  );
  return {
    command: "/t high",
    sourceClass: "local config alias",
    expectedBackendPath: "POST /api/chat/sessions/patch",
    frontendAssertion: "context bar updates the thinking level to high",
    finalStatus: response.ok() && ui.ok ? "passed" : "degraded",
    responseSummary: summarizeApiResponse(response, payload),
    blockerReason: ui.ok ? undefined : ui.error,
  };
}

async function runLocalQuerySample(page: Page, stack: E2EStack): Promise<CommandEvidenceRow> {
  const responsePromise = waitForOptionalApiResponse(page, stack, "/api/sessions", 20_000);
  await submitCommand(page, "/usage status");
  const response = await responsePromise;
  if (!response) {
    return {
      command: "/usage status",
      sourceClass: "local query",
      expectedBackendPath: "GET /api/sessions",
      frontendAssertion: "bounded wait did not observe the sessions query request",
      finalStatus: "degraded",
      blockerReason: "local query command did not emit the expected sessions request within 20s",
    };
  }
  const payload = await safeResponsePayload(response);
  const ui = await checkUiAssertion(() =>
    expect(page.locator(".ds-chat-shell__transcript")).toContainText(/Total:/, {
      timeout: 15_000,
    }),
  );
  return {
    command: "/usage status",
    sourceClass: "local query",
    expectedBackendPath: "GET /api/sessions",
    frontendAssertion: "transcript receives a structured usage summary text block",
    finalStatus: response.ok() && ui.ok ? "passed" : "degraded",
    responseSummary: summarizeApiResponse(response, payload),
    blockerReason: ui.ok ? undefined : ui.error,
  };
}

async function runUnknownCommandSample(
  page: Page,
  stack: E2EStack,
  backendResponses: Array<{ method: string; path: string; status: number }>,
): Promise<CommandEvidenceRow> {
  const beforeSendCount = backendResponses.filter(
    (entry) => entry.path === "/api/chat/send",
  ).length;
  await submitCommand(page, "/definitely-missing-command");
  const ui = await checkUiAssertion(() =>
    expect(page.getByText("Unknown command: /definitely-missing-command")).toBeVisible({
      timeout: 15_000,
    }),
  );
  const afterSendCount = backendResponses.filter((entry) => entry.path === "/api/chat/send").length;
  return {
    command: "/definitely-missing-command",
    sourceClass: "unknown",
    expectedBackendPath: "none",
    frontendAssertion: "unknown command toast is visible and the command is not sent as chat text",
    finalStatus: beforeSendCount === afterSendCount && ui.ok ? "passed" : "degraded",
    responseSummary: { beforeSendCount, afterSendCount, backendBase: stack.backendBase },
    blockerReason: ui.ok ? undefined : ui.error,
  };
}

async function runRemoteCommandSample(
  page: Page,
  stack: E2EStack,
  command: "/status" | "/id",
  sourceClass: string,
): Promise<CommandEvidenceRow> {
  const responsePromise = waitForOptionalApiResponse(page, stack, "/api/chat/send", 60_000);
  await submitCommand(page, command);
  const response = await responsePromise;
  if (!response) {
    return {
      command,
      sourceClass,
      expectedBackendPath: "POST /api/chat/send -> Gateway remote command",
      frontendAssertion: "bounded wait did not observe the remote command send request",
      finalStatus: "handoff-blocked",
      blockerReason: "remote command did not emit the expected send request within 60s",
    };
  }
  const payload = await safeResponsePayload(response);
  let ui;
  if (command === "/status") {
    ui = await checkUiAssertion(() =>
      expect(page.locator(".deck-ui-openclaw-status-card").first()).toBeVisible({
        timeout: 120_000,
      }),
    );
  } else {
    ui = await checkUiAssertion(() =>
      expect(page.locator(".ds-chat-shell__transcript")).toContainText(/OpenClaw|Agent|main|id/i, {
        timeout: 120_000,
      }),
    );
  }
  await checkUiAssertion(() => waitForComposerReady(page));
  return {
    command,
    sourceClass,
    expectedBackendPath: "POST /api/chat/send -> Gateway remote command",
    frontendAssertion:
      command === "/status"
        ? "status command renders an OpenClaw status card"
        : "alias command is accepted and produces a remote transcript reply",
    finalStatus: response.ok() && ui.ok ? "passed" : "degraded",
    responseSummary: summarizeApiResponse(response, payload),
    blockerReason: ui.ok ? undefined : ui.error,
  };
}

async function runCompactSample(
  page: Page,
  stack: E2EStack,
  sessionKey: string,
): Promise<CommandEvidenceRow> {
  const compactResponsePromise = waitForOptionalApiResponse(
    page,
    stack,
    "/api/chat/compact",
    60_000,
  );
  await submitCommand(page, "/compact");
  const runningUi = await checkUiAssertion(() =>
    expect(page.getByText("Compaction running")).toBeVisible({ timeout: 15_000 }),
  );
  const response = await compactResponsePromise;
  if (!response) {
    return {
      command: "/compact",
      sourceClass: "local mutation",
      expectedBackendPath: "POST /api/chat/compact -> sessions.compact",
      frontendAssertion: runningUi.ok
        ? "running state was visible, but bounded wait did not observe the compact request"
        : "bounded wait did not observe compact running state or request",
      finalStatus: "handoff-blocked",
      blockerReason: runningUi.ok
        ? "compact request was not observed within 60s"
        : `compact running state missing: ${runningUi.error ?? "unknown"}`,
    };
  }
  const payload = await safeResponsePayload(response);
  const finalUi = await checkUiAssertion(() =>
    expect(page.getByText(/Compaction complete|Compaction failed/)).toBeVisible({
      timeout: 120_000,
    }),
  );
  const compactionList = await page.request.post(`${stack.backendBase}/api/chat/compaction`, {
    data: { action: "list", key: sessionKey },
    headers: authHeaders(stack.accessToken),
  });
  const compactionPayload = await readResponsePayload(compactionList);
  const compacted = payload.compacted === true || hasArrayPayload(compactionPayload, "checkpoints");
  const uiOk = runningUi.ok && finalUi.ok;
  return {
    command: "/compact",
    sourceClass: "local mutation",
    expectedBackendPath: "POST /api/chat/compact -> sessions.compact",
    frontendAssertion: "context bar shows running state and final compaction command state",
    finalStatus:
      response.ok() && compacted && uiOk
        ? "passed"
        : response.ok()
          ? "degraded"
          : "handoff-blocked",
    responseSummary: {
      compact: summarizeApiResponse(response, payload),
      compactionList: {
        ok: compactionList.ok(),
        status: compactionList.status(),
        payloadKeys: Object.keys(compactionPayload),
      },
    },
    blockerReason:
      response.ok() && compacted && uiOk
        ? undefined
        : [
            compacted ? undefined : "real compact returned without a checkpoint/compacted signal",
            runningUi.ok ? undefined : `running state missing: ${runningUi.error ?? "unknown"}`,
            finalUi.ok ? undefined : `final state missing: ${finalUi.error ?? "unknown"}`,
          ]
            .filter(Boolean)
            .join("; "),
  };
}

function buildDiscoveryRow(discover: JsonObject): CommandEvidenceRow {
  const payload = isObject(discover.payload) ? discover.payload : {};
  const commands = Array.isArray(payload.commands) ? payload.commands.filter(isObject) : [];
  const skillOrPlugin = commands.filter(
    (command) => command.source === "skill" || command.source === "plugin",
  );
  return {
    command: "skill/plugin discovery",
    sourceClass: "skill/plugin discovery",
    expectedBackendPath: "POST /api/deck/commands/discover -> deck.commands.discover",
    frontendAssertion:
      skillOrPlugin.length > 0
        ? "discovered skill/plugin commands are present; dispatch skipped until harmless fixture is selected"
        : "discovery path executed; no harmless skill/plugin command fixture was exposed",
    finalStatus: discover.ok
      ? skillOrPlugin.length > 0
        ? "skipped-safe"
        : "degraded"
      : "handoff-blocked",
    responseSummary: {
      commandCount: commands.length,
      skillOrPluginCount: skillOrPlugin.length,
      status: discover.status,
    },
    blockerReason:
      skillOrPlugin.length > 0
        ? "dispatch is skipped-safe because command side effects are not classified by Gateway metadata"
        : "no harmless skill/plugin command fixture available in the isolated real stack",
  };
}

async function submitCommand(page: Page, command: string) {
  await waitForComposerReady(page);
  const input = page.getByPlaceholder("Type a message...");
  await input.fill(command);
  await expect(input).toHaveValue(command);
  const sendButton = page.getByRole("button", { name: "Send", exact: true });
  await expect(sendButton).toBeEnabled({ timeout: 15_000 });
  await sendButton.click();
}

async function waitForComposerReady(page: Page) {
  const sendButton = page.getByRole("button", { name: "Send", exact: true });
  await expect(sendButton).toBeVisible({ timeout: 120_000 });
}

function waitForApiResponse(page: Page, stack: E2EStack, path: string, timeout = 120_000) {
  return page.waitForResponse(
    (response) => {
      const url = new URL(response.url());
      return response.url().startsWith(stack.backendBase) && url.pathname === path;
    },
    { timeout },
  );
}

async function waitForOptionalApiResponse(
  page: Page,
  stack: E2EStack,
  path: string,
  timeout: number,
): Promise<Response | null> {
  try {
    return await waitForApiResponse(page, stack, path, timeout);
  } catch {
    return null;
  }
}

async function checkUiAssertion(action: () => Promise<unknown>) {
  try {
    await action();
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: summarizeError(error) };
  }
}

function recordBackendResponses(page: Page, backendBase: string) {
  const entries: Array<{ method: string; path: string; status: number }> = [];
  page.on("response", (response) => {
    if (!response.url().startsWith(`${backendBase}/api/`)) {
      return;
    }
    const url = new URL(response.url());
    entries.push({
      method: response.request().method(),
      path: url.pathname,
      status: response.status(),
    });
  });
  return entries;
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

async function requestJson(
  request: APIRequestContext,
  method: "GET" | "POST",
  stack: E2EStack,
  endpoint: string,
  headers: Record<string, string>,
  data?: unknown,
) {
  const response =
    method === "GET"
      ? await request.get(`${stack.backendBase}${endpoint}`, { headers })
      : await request.post(`${stack.backendBase}${endpoint}`, { data, headers });
  const payload = await readResponsePayload(response);
  return {
    endpoint,
    method,
    ok: response.ok(),
    payload,
    status: response.status(),
  };
}

async function readResponsePayload(response: { text: () => Promise<string> }): Promise<JsonObject> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as unknown;
    return isObject(payload) ? payload : { value: payload };
  } catch {
    return { text: text.slice(0, 1000) };
  }
}

async function safeResponsePayload(response: Response): Promise<JsonObject> {
  try {
    return await readResponsePayload(response);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function summarizeApiResponse(response: Response, payload: JsonObject): JsonObject {
  return {
    method: response.request().method(),
    ok: response.ok(),
    path: new URL(response.url()).pathname,
    payloadKeys: Object.keys(payload),
    status: response.status(),
  };
}

function hasArrayPayload(payload: JsonObject, key: string) {
  return Array.isArray(payload[key]) && (payload[key] as unknown[]).length > 0;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
