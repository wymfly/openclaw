import { expect, test, type APIResponse, type Page } from "@playwright/test";
import {
  authHeaders,
  buildRunScopedName,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type E2EStack,
} from "./helpers";

type JsonObject = Record<string, unknown>;

type ThreadEntry = {
  threadId?: unknown;
  channelId?: unknown;
  agentId?: unknown;
  targetSessionKey?: unknown;
  targetKind?: unknown;
  boundAt?: unknown;
  lastActivityAt?: unknown;
  accountId?: unknown;
  boundBy?: unknown;
  label?: unknown;
};

type Variant = {
  activity: string;
  activityUnsupported: RegExp;
  audit: string;
  auditUnsupported: RegExp;
  copySessionKey: string;
  empty: string;
  navLabel: string;
  raw: string;
  ready: RegExp;
  searchPlaceholder: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    activity: "Recent activity",
    activityUnsupported: /No thread activity projection/i,
    audit: "Audit",
    auditUnsupported: /No thread audit projection/i,
    copySessionKey: "Copy session key",
    empty: "No thread bindings found",
    navLabel: "Threads",
    raw: "Raw entry",
    ready: /Threads ready/,
    searchPlaceholder: "Search thread / channel / agent / session / label / account",
    theme: "dark",
    locale: "en",
    title: "Thread Bindings",
  },
  {
    activity: "最近活动",
    activityUnsupported: /暂无线程活动投影/,
    audit: "审计",
    auditUnsupported: /暂无线程审计投影/,
    copySessionKey: "复制会话键",
    empty: "暂无线程绑定",
    navLabel: "线程",
    raw: "原始条目",
    ready: /线程.*就绪/,
    searchPlaceholder: "搜索线程 / 渠道 / 智能体 / 会话 / 标签 / 账号",
    theme: "dark",
    locale: "zh",
    title: "线程绑定",
  },
  {
    activity: "Recent activity",
    activityUnsupported: /No thread activity projection/i,
    audit: "Audit",
    auditUnsupported: /No thread audit projection/i,
    copySessionKey: "Copy session key",
    empty: "No thread bindings found",
    navLabel: "Threads",
    raw: "Raw entry",
    ready: /Threads ready/,
    searchPlaceholder: "Search thread / channel / agent / session / label / account",
    theme: "light",
    locale: "en",
    title: "Thread Bindings",
  },
  {
    activity: "最近活动",
    activityUnsupported: /暂无线程活动投影/,
    audit: "审计",
    auditUnsupported: /暂无线程审计投影/,
    copySessionKey: "复制会话键",
    empty: "暂无线程绑定",
    navLabel: "线程",
    raw: "原始条目",
    ready: /线程.*就绪/,
    searchPlaceholder: "搜索线程 / 渠道 / 智能体 / 会话 / 标签 / 账号",
    theme: "light",
    locale: "zh",
    title: "线程绑定",
  },
];

test.describe("threads real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the threads real Gateway E2E",
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

  test("verifies route shapes, empty-valid data, UI variants, and BFF-only transport", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const runId = stack.realE2E?.runId ?? "real-threads";
    const impossibleAgentId = buildRunScopedName(runId, "no-such-thread-agent");
    const routeEvidence: JsonObject = { runId };

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `/runtime/gateway returned ${runtime.status()}`).toBe(true);
    routeEvidence.runtime = await responseShape(runtime);

    const threads = await request.get(`${stack.backendBase}/api/deck/threads?status=all`, {
      headers,
    });
    expect(threads.ok(), `/deck/threads returned ${threads.status()}`).toBe(true);
    const threadsShape = await responseShape(threads);
    const payload = threadsShape.payload as { threads?: ThreadEntry[] } | undefined;
    const rows = Array.isArray(payload?.threads) ? payload.threads : [];
    validateThreadRows(rows);
    routeEvidence.threads = {
      ...threadsShape,
      rowCount: rows.length,
      sampleThreadId: rows[0]?.threadId ?? null,
    };

    const discord = await request.get(
      `${stack.backendBase}/api/deck/threads?channel=discord&status=all`,
      {
        headers,
      },
    );
    expect(discord.ok(), `/deck/threads channel filter returned ${discord.status()}`).toBe(true);
    routeEvidence.discordFilter = await responseShape(discord);

    const impossible = await request.get(
      `${stack.backendBase}/api/deck/threads?agentId=${encodeURIComponent(impossibleAgentId)}&status=all`,
      { headers },
    );
    expect(impossible.ok(), `/deck/threads impossible filter returned ${impossible.status()}`).toBe(
      true,
    );
    const impossibleShape = await responseShape(impossible);
    const impossibleRows = Array.isArray(impossibleShape.payload?.threads)
      ? impossibleShape.payload.threads
      : [];
    expect(impossibleRows).toHaveLength(0);
    routeEvidence.impossibleFilter = impossibleShape;

    const unsupportedDelete = await request.delete(
      `${stack.backendBase}/api/deck/threads/${encodeURIComponent(impossibleAgentId)}`,
      { headers },
    );
    expect([404, 405]).toContain(unsupportedDelete.status());
    routeEvidence.unsupportedDelete = {
      ...(await responseShape(unsupportedDelete)),
      skippedSafe: true,
      reason: "no verified thread mutation contract exists",
    };

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

        const threadsNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await threadsNav.scrollIntoViewIfNeeded();
        await threadsNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "threads",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("threads-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("heading", { name: variant.title })).toBeVisible();
        await expect(panel.getByText(variant.ready)).toBeVisible();

        const rowCount = await panel.locator(".threads-panel__thread-row").count();
        if (rowCount > 0) {
          await panel.locator(".threads-panel__thread-row").first().click();
          await panel.getByRole("tab", { name: variant.activity }).click();
          await expect(panel.getByText(variant.activityUnsupported)).toBeVisible();
          await panel.getByRole("tab", { name: variant.audit }).click();
          await expect(panel.getByText(variant.auditUnsupported)).toBeVisible();
          await panel.getByRole("tab", { name: variant.raw }).click();
          await expect(panel.getByText(/Thread payload|线程载荷/)).toBeVisible();
          await panel.getByRole("button", { name: variant.copySessionKey }).click();
          await expect(panel.locator(".threads-panel__handoff")).toContainText(
            /session key|会话键/i,
          );
        } else {
          await expect(panel.getByText(variant.empty)).toBeVisible();
          await expect(panel.getByText(/Pick a thread binding|选择一个线程绑定/)).toBeVisible();
        }

        await panel.getByPlaceholder(variant.searchPlaceholder).fill(impossibleAgentId);
        await expect(panel.locator(".threads-panel__thread-row")).toHaveCount(0);
        await expect(panel.getByText(variant.empty)).toBeVisible();

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          directGateway,
          locale: variant.locale,
          navigation: "chat-to-threads",
          rowCount,
          theme: variant.theme,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }

    const evidence: JsonObject = {
      routeEvidence,
      runId,
      scenarioId: "threads.real.product-surface",
      status: rows.length > 0 ? "passed" : "empty-valid",
      unsupported: {
        activity: "skipped-safe: no thread activity projection contract",
        audit: "skipped-safe: no thread audit projection contract",
        mutations: "skipped-safe: no thread mutation contract",
      },
      uiEvidence,
    };
    await writeRealE2EScenarioEvidence(stack, "threads-real-product-surface", evidence, testInfo);
  });
});

function validateThreadRows(rows: ThreadEntry[]) {
  for (const thread of rows) {
    expect(typeof thread.threadId).toBe("string");
    expect(typeof thread.channelId).toBe("string");
    expect(typeof thread.agentId).toBe("string");
    expect(typeof thread.targetSessionKey).toBe("string");
    expect(typeof thread.targetKind).toBe("string");
    expect(typeof thread.boundAt).toBe("number");
    expect(typeof thread.lastActivityAt).toBe("number");
    expect(typeof thread.accountId).toBe("string");
    expect(typeof thread.boundBy).toBe("string");
    if (thread.label !== undefined) {
      expect(typeof thread.label).toBe("string");
    }
  }
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
    if (url.startsWith(`${backendBase}/api/deck/threads/`) && [404, 405].includes(status)) {
      return;
    }
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
