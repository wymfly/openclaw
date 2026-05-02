import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("contract-chain browser smoke", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("exercises migrated contract surfaces through Deck Go", async ({ page, request }) => {
    await openDeck(page, stack.frontendBase, "agents");
    await expect(page.getByRole("region", { name: /Agents|Agent detail/i }).first()).toBeVisible();

    const agents = await postJSON(
      request,
      `${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`,
      {
        method: "agents.list",
        params: {},
      },
    );
    const agentResult = recordAt(agents, "result");
    const agentItems = arrayAt(agentResult, "agents");
    expect(stringAt(agentResult, "defaultId")).toBe("main");
    expect(stringAt(agentItems[0], "id")).toBe("main");
    expect(stringAt(recordAt(agentItems[0], "model"), "primary")).toBe("gpt-5.4");

    const agentDetail = await getJSON(request, `${stack.backendBase}/api/deck/agents?agentId=main`);
    expect(stringAt(agentDetail, "id")).toBe("main");
    expect(stringAt(agentDetail, "workspace")).toBe("/tmp/openclaw-main");

    const sessions = await getJSON(request, `${stack.backendBase}/api/sessions`);
    expect(stringAt(arrayAt(sessions, "sessions")[0], "key")).toBe("session:mock:1");

    await openDeck(page, stack.frontendBase, "chat");
    await postJSON(request, `${stack.backendBase}/api/chat/sessions/create`, {
      agentId: "main",
      message: "hello from contract-chain smoke",
      label: "Contract smoke",
    });
    await waitForGatewayMethod(stack.requestLog, "sessions.create");

    const runtime = await getJSON(request, `${stack.backendBase}/api/runtime/gateway`);
    expect(stringAt(runtime, "mode")).toBe("bundled");
    expect(numberAt(runtime, "pid")).toBeGreaterThan(0);

    const settings = await getJSON(request, `${stack.backendBase}/api/settings`);
    expect(recordAt(settings, "settings")).toBeTruthy();

    const cost = await getJSON(request, `${stack.backendBase}/api/models/usage/cost?days=7`);
    expect(numberAt(arrayAt(cost, "daily")[0], "totalCost")).toBe(0.33);

    const providers = await getJSON(request, `${stack.backendBase}/api/models/usage/providers`);
    expect(stringAt(arrayAt(providers, "providers")[0], "provider")).toBe("openai");

    const usage = await getJSON(request, `${stack.backendBase}/api/usage/sessions`);
    expect(numberAt(recordAt(usage, "totals"), "totalTokens")).toBe(18);
    const usageSessions = arrayAt(usage, "sessions");
    expect(numberAt(recordAt(usageSessions[0], "usage"), "totalCost")).toBe(0.33);

    const monitor = await getJSON(request, `${stack.backendBase}/api/monitor/runs`);
    expect(Array.isArray(monitor.runs)).toBe(true);

    const approvals = await getJSON(request, `${stack.backendBase}/api/approvals`);
    expect(stringAt(approvals, "hash")).toBe("hash-1");
    expect(stringAt(recordAt(recordAt(approvals, "file"), "defaults"), "security")).toBe(
      "on-request",
    );

    const pending = await getJSON(request, `${stack.backendBase}/api/approvals/pending`);
    const pendingItems = arrayAt(pending, "pending");
    expect(stringAt(pendingItems[0], "id")).toBe("approval-1");
    expect(stringAt(pendingItems[0], "command")).toBe("npm test");

    await assertStreamReconnect(page, stack.backendBase);
  });
});

type JSONRecord = Record<string, unknown>;

async function getJSON(request: APIRequestContext, url: string): Promise<JSONRecord> {
  const response = await request.get(url);
  expect(response.ok(), `${url} returned ${response.status()}`).toBe(true);
  return (await response.json()) as JSONRecord;
}

async function postJSON(
  request: APIRequestContext,
  url: string,
  data: JSONRecord,
): Promise<JSONRecord> {
  const response = await request.post(url, { data });
  expect(response.ok(), `${url} returned ${response.status()}`).toBe(true);
  return (await response.json()) as JSONRecord;
}

function recordAt(record: JSONRecord, key: string): JSONRecord {
  const value = record[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JSONRecord;
}

function arrayAt(record: JSONRecord, key: string): JSONRecord[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is JSONRecord => !!item && typeof item === "object" && !Array.isArray(item),
  );
}

function stringAt(record: JSONRecord | undefined, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function numberAt(record: JSONRecord | undefined, key: string): number {
  const value = record?.[key];
  return typeof value === "number" ? value : 0;
}

async function assertStreamReconnect(page: Page, backendBase: string) {
  const attempts = await page.evaluate(async (base) => {
    async function connect(lastEventId: string) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);
      try {
        const response = await fetch(`${base}/api/stream`, {
          headers: lastEventId ? { "Last-Event-ID": lastEventId } : {},
          signal: controller.signal,
        });
        return {
          ok: response.ok,
          contentType: response.headers.get("content-type") ?? "",
        };
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    }
    return [await connect(""), await connect("1")];
  }, backendBase);

  expect(attempts).toHaveLength(2);
  for (const attempt of attempts) {
    expect(attempt.ok).toBe(true);
    expect(attempt.contentType).toContain("text/event-stream");
  }
}
