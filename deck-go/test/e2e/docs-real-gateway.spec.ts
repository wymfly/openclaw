import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  assertRunScopedCleanupTarget,
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;
type DocsFixture = {
  cleanup: JsonObject;
  docs: JsonObject[];
  evidence: JsonObject;
  runId: string;
  sessionKey: string;
  status: "passed" | "degraded" | "empty-valid" | "handoff-blocked";
};

test.describe("docs real deck-go BFF contract chain", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the docs real Gateway E2E",
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

  test("verifies Docs route shapes, fixture extraction, UI variants, and cleanup", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const fixture = await createRunScopedDocsFixture(request, stack, testInfo);
    const routeEvidence: JsonObject = {
      fixture: fixture.evidence,
    };
    const uiEvidence: JsonObject[] = [];

    try {
      const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
      expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
      routeEvidence.runtime = await jsonShape(runtime);

      const list = await request.get(`${stack.backendBase}/api/docs`, { headers });
      expect(list.ok(), `/api/docs returned ${list.status()}`).toBe(true);
      const listPayload = await jsonShape(list);
      const listDocs = Array.isArray(listPayload.docs) ? listPayload.docs : [];
      routeEvidence.list = {
        count: listDocs.length,
        keys: Object.keys(listPayload),
        status: list.status(),
      };

      const firstRunDoc = fixture.docs[0];
      if (firstRunDoc && typeof firstRunDoc.id === "string") {
        const detail = await request.get(
          `${stack.backendBase}/api/docs/${encodeURIComponent(firstRunDoc.id)}`,
          { headers },
        );
        expect(detail.ok(), `/api/docs/{runScopedId} returned ${detail.status()}`).toBe(true);
        const detailPayload = await jsonShape(detail);
        expect(docIncludesRunId(detailPayload, fixture.runId)).toBe(true);
        routeEvidence.detail = {
          id: firstRunDoc.id,
          keys: Object.keys(detailPayload),
          status: detail.status(),
        };
      } else {
        const detail = await request.get(
          `${stack.backendBase}/api/docs/__deck_go_e2e_missing_doc__`,
          { headers },
        );
        expect(detail.status(), "missing detail should be empty-valid 404").toBe(404);
        routeEvidence.detail = {
          reason: "empty-valid: no run-scoped extracted doc was available",
          status: detail.status(),
        };
      }

      for (const variant of [
        {
          locale: "en" as const,
          theme: "dark" as const,
          navLabel: "Docs",
          title: "Doc Hub",
          searchPlaceholder: "Search docs... (⌘K)",
          deleteLabel: "Delete",
          confirmDeleteLabel: "Confirm delete",
          cancelLabel: "Cancel",
          extractLabel: "Extract from session",
          refreshLabel: "Refresh docs",
          payloadLabel: "Doc payload",
          openSourceSessionLabel: "Open source session",
        },
        {
          locale: "zh" as const,
          theme: "dark" as const,
          navLabel: "文档",
          title: "文档中心",
          searchPlaceholder: "搜索文档... (⌘K)",
          deleteLabel: "删除",
          confirmDeleteLabel: "确认删除",
          cancelLabel: "取消",
          extractLabel: "从 session 提取",
          refreshLabel: "刷新文档",
          payloadLabel: "文档载荷",
          openSourceSessionLabel: "打开来源 session",
        },
        {
          locale: "en" as const,
          theme: "light" as const,
          navLabel: "Docs",
          title: "Doc Hub",
          searchPlaceholder: "Search docs... (⌘K)",
          deleteLabel: "Delete",
          confirmDeleteLabel: "Confirm delete",
          cancelLabel: "Cancel",
          extractLabel: "Extract from session",
          refreshLabel: "Refresh docs",
          payloadLabel: "Doc payload",
          openSourceSessionLabel: "Open source session",
        },
        {
          locale: "zh" as const,
          theme: "light" as const,
          navLabel: "文档",
          title: "文档中心",
          searchPlaceholder: "搜索文档... (⌘K)",
          deleteLabel: "删除",
          confirmDeleteLabel: "确认删除",
          cancelLabel: "取消",
          extractLabel: "从 session 提取",
          refreshLabel: "刷新文档",
          payloadLabel: "文档载荷",
          openSourceSessionLabel: "打开来源 session",
        },
      ]) {
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

          const docsNav = page
            .locator(".deck-ui-rail")
            .getByRole("button", { exact: true, name: variant.navLabel });
          await docsNav.scrollIntoViewIfNeeded();
          await docsNav.click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "docs");
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

          const panel = page.getByTestId("docs-panel");
          await expect(panel).toBeVisible();
          await expect(panel.getByText(variant.title).first()).toBeVisible();
          await expect(panel.getByRole("button", { name: variant.refreshLabel })).toBeVisible();

          const extractButton = panel.getByRole("button", { name: variant.extractLabel });
          const extractControl = (await extractButton.isEnabled().catch(() => false))
            ? "enabled"
            : "disabled-no-active-session";

          if (fixture.docs.length > 0) {
            await panel.getByPlaceholder(variant.searchPlaceholder).fill(fixture.runId);
            await expect(panel.locator(".docs-panel__search-list button").first()).toBeVisible({
              timeout: 20_000,
            });
            await panel.locator(".docs-panel__search-list button").first().click();
            await expect(panel.getByText(fixture.runId).first()).toBeVisible({ timeout: 20_000 });

            const categoryHead = panel.locator(".docs-panel__tree-group-head").first();
            await categoryHead.click();
            await categoryHead.click();

            const keywordButton = panel.locator(".docs-panel__keyword-row button").first();
            if (await keywordButton.isVisible().catch(() => false)) {
              await keywordButton.click();
              await expect(panel.locator(".docs-panel__keyword-filter")).toBeVisible();
              await panel.locator(".docs-panel__keyword-filter button").click();
            }

            const relatedButton = panel.locator(".docs-panel__related button").first();
            const relatedState = (await relatedButton.isVisible().catch(() => false))
              ? "clicked"
              : "no-related-docs";
            if (relatedState === "clicked") {
              await relatedButton.click();
              await expect(panel.locator(".docs-panel__reader")).toBeVisible();
              await panel.getByPlaceholder(variant.searchPlaceholder).fill(fixture.runId);
              await expect(panel.locator(".docs-panel__search-list button").first()).toBeVisible({
                timeout: 20_000,
              });
              await panel.locator(".docs-panel__search-list button").first().click();
              await expect(panel.getByText(fixture.runId).first()).toBeVisible({ timeout: 20_000 });
            }

            await panel.getByText(variant.payloadLabel).click();
            await expect(panel.getByText(fixture.runId).first()).toBeVisible();
            const outlineCount = await panel.locator(".docs-panel__outline li").count();

            await panel.getByRole("button", { exact: true, name: variant.deleteLabel }).click();
            await expect(
              panel.getByRole("button", { name: variant.confirmDeleteLabel }),
            ).toBeVisible();
            await panel.getByRole("button", { exact: true, name: variant.cancelLabel }).click();

            const sourceSessionButton = panel.getByRole("button", {
              name: variant.openSourceSessionLabel,
            });
            const sourceSessionState = (await sourceSessionButton.isVisible().catch(() => false))
              ? "clicked"
              : "not-available";
            if (sourceSessionState === "clicked") {
              await sourceSessionButton.click();
              await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
                "data-active-panel",
                "sessions",
              );
            }

            uiEvidence.push({
              extractControl,
              fixtureDocs: fixture.docs.length,
              locale: variant.locale,
              outlineCount,
              relatedState,
              sourceSessionState,
              theme: variant.theme,
            });
          } else {
            await panel.getByPlaceholder(variant.searchPlaceholder).fill(fixture.runId);
            await expect(
              panel.getByText(/No docs match|没有匹配文档|No docs loaded|暂无已加载文档/),
            ).toBeVisible();
            uiEvidence.push({
              extractControl,
              fixtureDocs: 0,
              locale: variant.locale,
              theme: variant.theme,
            });
          }

          await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
          expect(unexpected.consoleErrors).toEqual([]);
          expect(unexpected.pageErrors).toEqual([]);
          expect(directGateway.requests).toEqual([]);
          expect(directGateway.websockets).toEqual([]);
        } finally {
          await context.close();
        }
      }
    } finally {
      fixture.cleanup = await cleanupRunScopedDocsFixture(request, stack, fixture);
    }

    await writeRealE2EScenarioEvidence(
      stack,
      "docs-real-product-surface",
      {
        scenarioId: "docs.real.product-surface",
        runId: fixture.runId,
        status: fixture.status,
        cleanup: fixture.cleanup,
        routeEvidence,
        uiEvidence,
      },
      testInfo,
    );
  });
});

async function createRunScopedDocsFixture(
  request: APIRequestContext,
  stack: E2EStack,
  testInfo: { retry: number; workerIndex: number },
): Promise<DocsFixture> {
  const runId =
    stack.realE2E?.runId ?? `deckgo-e2e-docs-w${testInfo.workerIndex}-r${testInfo.retry}`;
  const sessionKey = buildRunScopedName(runId, "docs-session");
  const label = buildRunScopedName(runId, "Docs fixture session");
  const model = process.env.DECK_GO_REAL_GATEWAY_E2E_MODEL ?? "gpt-5.4";
  const evidence: JsonObject = {
    attempts: [],
    label,
    model,
    runId,
    scenarioId: "docs.real.fixture",
    sessionKey,
    status: "handoff-blocked",
  };

  const create = await rpcMaybe(request, stack, "sessions.create", {
    agentId: "main",
    key: sessionKey,
    label,
    message: [
      `Write a markdown operational note for deck-go real E2E run ${runId}.`,
      `The H1 must be "Deck Docs E2E ${runId}".`,
      `Include the exact run id ${runId} in at least two paragraphs.`,
      "Use sections named Contract chain, Verification steps, and Cleanup guard.",
      "Write at least 260 words so the Docs extractor treats this assistant reply as a document.",
    ].join(" "),
    model,
  });
  (evidence.attempts as unknown[]).push({ step: "sessions.create", ...create });

  if (!create.ok) {
    evidence.status = "handoff-blocked";
    return { cleanup: {}, docs: [], evidence, runId, sessionKey, status: "handoff-blocked" };
  }

  const history = await waitForRunScopedAssistantHistory(request, stack, sessionKey, runId);
  evidence.history = history;

  const extract = await postJson(request, stack, "/api/docs/extract", { sessionKey });
  (evidence.attempts as unknown[]).push({ step: "docs.extract", ...extract });
  evidence.extract = extract;

  const extractDocs = asRecordArray(extract.payload.docs);
  const docs = extractDocs.filter((doc) => docIncludesRunId(doc, runId));
  evidence.extractedCount = extractDocs.length;
  evidence.runScopedDocCount = docs.length;

  const status =
    docs.length > 0
      ? "passed"
      : extract.ok
        ? "empty-valid"
        : history.status === "passed"
          ? "degraded"
          : "handoff-blocked";
  evidence.status = status;
  return { cleanup: {}, docs, evidence, runId, sessionKey, status };
}

async function cleanupRunScopedDocsFixture(
  request: APIRequestContext,
  stack: E2EStack,
  fixture: DocsFixture,
) {
  const cleanup: JsonObject = {
    docs: [],
    session: "not-run",
  };
  for (const doc of fixture.docs) {
    const id = typeof doc.id === "string" ? doc.id : "";
    if (!id) {
      continue;
    }
    assertRunScopedCleanupTarget(
      {
        id,
        name: typeof doc.sourceSession === "string" ? doc.sourceSession : "",
        runId: fixture.runId,
        title: typeof doc.title === "string" ? doc.title : "",
      },
      fixture.runId,
    );
    const deleted = await deleteRoute(request, stack, `/api/docs/${encodeURIComponent(id)}`);
    (cleanup.docs as unknown[]).push({ id, ...deleted });
  }

  if (fixture.sessionKey.includes(fixture.runId)) {
    cleanup.session = await rpcMaybe(request, stack, "sessions.delete", {
      deleteTranscript: true,
      emitLifecycleHooks: false,
      key: fixture.sessionKey,
    });
  }
  return cleanup;
}

async function waitForRunScopedAssistantHistory(
  request: APIRequestContext,
  stack: E2EStack,
  sessionKey: string,
  runId: string,
) {
  const attempts: JsonObject[] = [];
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const history = await getJson(
      request,
      stack,
      `/api/chat/history?sessionKey=${encodeURIComponent(sessionKey)}&limit=40`,
    );
    attempts.push(history);
    const messages = asRecordArray(history.payload.messages);
    const hasRunScopedAssistant = messages.some((message) => {
      if (message.role !== "assistant") {
        return false;
      }
      const text = contentToText(message.content);
      return text.includes(runId) || text.trim().length > 220;
    });
    if (history.ok && hasRunScopedAssistant) {
      return {
        attempts,
        messageCount: messages.length,
        status: "passed",
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return {
    attempts,
    status: "empty-valid",
  };
}

async function rpcMaybe(
  request: APIRequestContext,
  stack: E2EStack,
  method: string,
  params: JsonObject,
) {
  const evidence = await postJson(request, stack, "/api/v1/runtimes/rt_local/gateway/rpc", {
    method,
    params,
  });
  const payload = evidence.payload;
  return {
    ...evidence,
    ok: evidence.ok && !(typeof payload === "object" && payload !== null && "error" in payload),
  };
}

async function getJson(request: APIRequestContext, stack: E2EStack, path: string) {
  const response = await request.get(`${stack.backendBase}${path}`, {
    headers: authHeaders(stack.accessToken),
  });
  return routeEvidence(response);
}

async function postJson(
  request: APIRequestContext,
  stack: E2EStack,
  path: string,
  data: JsonObject,
) {
  const response = await request.post(`${stack.backendBase}${path}`, {
    data,
    headers: authHeaders(stack.accessToken),
  });
  return routeEvidence(response);
}

async function deleteRoute(request: APIRequestContext, stack: E2EStack, path: string) {
  const response = await request.delete(`${stack.backendBase}${path}`, {
    headers: authHeaders(stack.accessToken),
  });
  return routeEvidence(response);
}

async function routeEvidence(response: {
  json: () => Promise<unknown>;
  ok: () => boolean;
  status: () => number;
}) {
  const payload = await jsonShape(response);
  return {
    ok: response.ok(),
    payload,
    status: response.status(),
  };
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

function asRecordArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is JsonObject => typeof entry === "object" && entry !== null)
    : [];
}

function docIncludesRunId(doc: JsonObject, runId: string) {
  return [
    doc.id,
    doc.title,
    doc.content,
    doc.sourceSession,
    doc.sourceAgent,
    ...(Array.isArray(doc.keywords) ? doc.keywords : []),
  ].some((value) => typeof value === "string" && value.includes(runId));
}

function contentToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      if (typeof entry === "object" && entry !== null && "text" in entry) {
        return typeof entry.text === "string" ? entry.text : "";
      }
      return "";
    })
    .join("\n");
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
