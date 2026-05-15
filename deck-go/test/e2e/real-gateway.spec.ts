import { expect, test, type Page } from "@playwright/test";
import {
  authHeaders,
  openDeck,
  seedRealGatewayChat,
  startRealGatewayStack,
  type E2EStack,
} from "./helpers";

test.describe("real OpenClaw Gateway", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the real Gateway E2E smoke",
  );
  test.setTimeout(420_000);

  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    testInfo.setTimeout(420_000);
    stack = await startRealGatewayStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("exercises the real Gateway control plane through deck-go", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `runtime gateway returned ${runtime.status()}`).toBe(true);
    const runtimePayload = (await runtime.json()) as { mode?: string; lifecycleState?: string };
    expect(runtimePayload.mode).toBe("local");
    expect(runtimePayload.lifecycleState).toBe("running");

    const health = await request.get(`${stack.backendBase}/api/gateway/health`, { headers });
    expect(health.ok(), `gateway health returned ${health.status()}`).toBe(true);
    const healthPayload = (await health.json()) as { ok?: boolean };
    expect(healthPayload.ok).not.toBe(false);

    const agents = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
      headers,
      data: {
        method: "agents.list",
        params: {},
      },
    });
    expect(agents.ok(), `agents.list returned ${agents.status()}`).toBe(true);
    const agentsPayload = (await agents.json()) as { result?: { agents?: unknown[] } };
    expect(Array.isArray(agentsPayload.result?.agents)).toBe(true);

    const seed = await seedRealGatewayChat(request, stack, testInfo);
    expect(seed.sessionStatus).toBe("passed");
  });

  test("renders Chat and Agents against the real Gateway without API disconnects", async ({
    page,
  }) => {
    const badResponses = recordBadAPIResponses(page, stack.backendBase);

    await openDeck(page, stack.frontendBase, "chat", stack.accessToken);
    await expect(page.getByLabel("Chat workspace")).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(badResponses).toEqual([]);

    await openDeck(page, stack.frontendBase, "agents", stack.accessToken);
    await expect(page.getByRole("region", { name: /Agents|Agent detail/i }).first()).toBeVisible();
    await expect(page.getByRole("main").first()).toContainText(/main|Agents/);
    await page.waitForTimeout(1_000);
    expect(badResponses).toEqual([]);
  });
});

function recordBadAPIResponses(page: Page, backendBase: string) {
  const badResponses: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(`${backendBase}/api/`) && response.status() >= 400) {
      badResponses.push(`${response.status()} ${url}`);
    }
  });
  return badResponses;
}
