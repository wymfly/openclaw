import { expect, test, type Page } from "@playwright/test";
import { authHeaders, openDeck, startRealGatewayStack, type E2EStack } from "./helpers";

test.describe("agents real OpenClaw Gateway contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the agents real Gateway E2E",
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

  test("verifies agents API workflows through deck-go and real Gateway", async ({ request }) => {
    const headers = authHeaders(stack.accessToken);

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
    await expect(runtime.json()).resolves.toMatchObject({ mode: "bundled" });

    const describe = await request.get(`${stack.backendBase}/api/gateway/describe`, {
      headers,
      params: { includeSchemas: "true" },
    });
    expect(describe.ok(), `gateway.describe returned ${describe.status()}`).toBe(true);
    const describePayload = (await describe.json()) as {
      methods?: Record<string, unknown>;
      untyped?: string[];
    };
    for (const method of [
      "agents.list",
      "agents.create",
      "agents.update",
      "agents.delete",
      "deck.agents.detail",
      "deck.agents.skills.get",
      "deck.agents.skills.set",
      "deck.agents.subagents.get",
      "deck.agents.eventStreams.get",
      "deck.agents.toolPolicy.preview",
      "deck.agents.systemPrompt.preview",
    ]) {
      expect(
        describePayload.methods?.[method],
        `${method} missing from gateway.describe`,
      ).toBeTruthy();
      expect(describePayload.untyped ?? [], `${method} should be typed`).not.toContain(method);
    }

    const agents = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
      headers,
      data: { method: "agents.list", params: {} },
    });
    expect(agents.ok(), `agents.list returned ${agents.status()}`).toBe(true);
    const agentsPayload = (await agents.json()) as {
      result?: { agents?: Array<{ id?: string }>; defaultId?: string };
    };
    const agentId = agentsPayload.result?.defaultId ?? agentsPayload.result?.agents?.[0]?.id;
    expect(agentId, "expected at least one real Gateway agent").toBeTruthy();

    const detail = await request.get(`${stack.backendBase}/api/deck/agents`, {
      headers,
      params: { agentId: agentId ?? "main" },
    });
    expect(detail.ok(), `deck agents detail returned ${detail.status()}`).toBe(true);
    await expect(detail.json()).resolves.toMatchObject({ id: agentId });

    for (const action of [
      "skills.get",
      "subagents.get",
      "eventStreams.get",
      "toolPolicy.preview",
      "systemPrompt.preview",
    ]) {
      const response = await request.post(`${stack.backendBase}/api/deck/agents`, {
        headers,
        data: { action, agentId },
      });
      expect(response.ok(), `${action} returned ${response.status()}`).toBe(true);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(Object.keys(payload).length, `${action} returned an empty object`).toBeGreaterThan(0);
    }

    const files = await request.get(
      `${stack.backendBase}/api/agents/${encodeURIComponent(agentId ?? "main")}/files`,
      { headers },
    );
    expect(files.ok(), `agent files returned ${files.status()}`).toBe(true);
    const filesPayload = (await files.json()) as { files?: unknown[] };
    expect(Array.isArray(filesPayload.files)).toBe(true);

    const identity = await request.get(
      `${stack.backendBase}/api/agents/${encodeURIComponent(agentId ?? "main")}/identity`,
      { headers },
    );
    expect(identity.ok(), `agent identity returned ${identity.status()}`).toBe(true);
    await expect(identity.json()).resolves.toMatchObject({ agentId });
  });

  test("renders agents UI with real data and read-only section navigation", async ({ page }) => {
    const unexpected = recordUnexpected(page, stack.backendBase);

    await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await expect(page.getByRole("main").first()).toContainText(/Agents|main/i);

    const firstRow = page
      .locator('[role="listitem"] button')
      .filter({ hasText: /main|agent/i })
      .first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page.getByRole("region", { name: /Agent detail/i })).toBeVisible();

    await page.getByRole("tab", { name: /Event Streams/i }).click();
    await expect(page.getByText(/lifecycle|assistant|session\.message/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /Tool Policy/i }).click();
    await expect(page.getByText(/Allowed|Denied|No/i).first()).toBeVisible();

    await expect.poll(() => unexpected).toEqual([]);
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
