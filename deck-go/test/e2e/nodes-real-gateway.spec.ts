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

type Variant = {
  cancelLabel: string;
  navLabel: string;
  refreshLabel: string;
  rejectPairingLabel: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
};

const VARIANTS: Variant[] = [
  {
    cancelLabel: "Cancel",
    navLabel: "Nodes",
    refreshLabel: "Refresh nodes",
    rejectPairingLabel: "Reject pairing",
    theme: "dark",
    locale: "en",
  },
  {
    cancelLabel: "取消",
    navLabel: "节点",
    refreshLabel: "刷新节点",
    rejectPairingLabel: "拒绝配对",
    theme: "dark",
    locale: "zh",
  },
  {
    cancelLabel: "Cancel",
    navLabel: "Nodes",
    refreshLabel: "Refresh nodes",
    rejectPairingLabel: "Reject pairing",
    theme: "light",
    locale: "en",
  },
  {
    cancelLabel: "取消",
    navLabel: "节点",
    refreshLabel: "刷新节点",
    rejectPairingLabel: "拒绝配对",
    theme: "light",
    locale: "zh",
  },
];

test.describe("nodes real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the nodes real Gateway E2E",
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

  test("verifies nodes route shapes, UI variants, BFF-only transport, and skipped-safe mutations", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const jsonHeaders = { ...headers, "Content-Type": "application/json" };
    const runId = stack.realE2E?.runId ?? stack.runId;
    const fixtureNodeId = buildRunScopedName(runId, "node");
    const fixtureName = buildRunScopedName(runId, "pairing");
    const routeEvidence: JsonObject = { runId };

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `/runtime/gateway returned ${runtime.status()}`).toBe(true);
    routeEvidence.runtime = await responseShape(runtime);

    const nodes = await request.get(`${stack.backendBase}/api/nodes`, { headers });
    expect([200, 502], `/nodes returned ${nodes.status()}`).toContain(nodes.status());
    const nodesShape = await responseShape(nodes);
    routeEvidence.nodes = {
      ...nodesShape,
      count: Array.isArray(nodesShape.payload?.nodes) ? nodesShape.payload.nodes.length : null,
    };

    const pairing = await request.get(`${stack.backendBase}/api/nodes/pair`, { headers });
    expect([200, 502], `/nodes/pair returned ${pairing.status()}`).toContain(pairing.status());
    const pairingShape = await responseShape(pairing);
    routeEvidence.pairing = {
      ...pairingShape,
      count: Array.isArray(pairingShape.payload?.pending)
        ? pairingShape.payload.pending.length
        : null,
    };

    const fixture = await request.post(`${stack.backendBase}/api/nodes/pair`, {
      headers: jsonHeaders,
      data: {
        action: "request",
        nodeId: fixtureNodeId,
        displayName: fixtureName,
        platform: "darwin",
        version: "deck-go-e2e",
        coreVersion: "deck-go-e2e",
        uiVersion: "deck-go-e2e",
        deviceFamily: "test-fixture",
        modelIdentifier: "deck-go-real-e2e",
        remoteIp: "127.0.0.1",
        caps: ["status.request"],
        commands: ["status.request"],
        silent: true,
      },
    });
    expect([200, 400, 404, 422, 502], `/nodes/pair request returned ${fixture.status()}`).toContain(
      fixture.status(),
    );
    const fixtureShape = await responseShape(fixture);
    const fixtureRequestId = extractRequestId(fixtureShape.payload);
    const fixtureCreated = fixture.status() === 200 && Boolean(fixtureRequestId);
    routeEvidence.fixture = {
      created: fixtureCreated,
      nodeId: fixtureNodeId,
      requestId: fixtureRequestId,
      shape: fixtureShape,
    };

    const describe = await request.post(`${stack.backendBase}/api/nodes`, {
      headers: jsonHeaders,
      data: { action: "describe", nodeId: fixtureNodeId },
    });
    expect([200, 400, 404, 502], `/nodes describe returned ${describe.status()}`).toContain(
      describe.status(),
    );
    routeEvidence.describe = await responseShape(describe);

    const invoke = await request.post(`${stack.backendBase}/api/nodes`, {
      headers: jsonHeaders,
      data: {
        action: "invoke",
        nodeId: fixtureNodeId,
        command: "status.request",
        params: { runId },
        idempotencyKey: buildRunScopedName(runId, "nodes-invoke"),
      },
    });
    expect([200, 400, 404, 422, 502], `/nodes invoke returned ${invoke.status()}`).toContain(
      invoke.status(),
    );
    routeEvidence.invoke = await responseShape(invoke);

    const pendingWork = await request.post(`${stack.backendBase}/api/nodes`, {
      headers: jsonHeaders,
      data: {
        action: "pending.enqueue",
        nodeId: fixtureNodeId,
        type: "status.request",
        priority: "normal",
        wake: false,
      },
    });
    expect(
      [200, 400, 404, 422, 502],
      `/nodes pending.enqueue returned ${pendingWork.status()}`,
    ).toContain(pendingWork.status());
    routeEvidence.pendingWork = await responseShape(pendingWork);

    const approve = await request.post(`${stack.backendBase}/api/nodes/pair`, {
      headers: jsonHeaders,
      data: { action: "approve", requestId: buildRunScopedName(runId, "nonexistent-approve") },
    });
    expect([200, 400, 404, 422, 502], `/nodes/pair approve returned ${approve.status()}`).toContain(
      approve.status(),
    );
    routeEvidence.approveNonexistent = await responseShape(approve);

    const verify = await request.post(`${stack.backendBase}/api/nodes/pair`, {
      headers: jsonHeaders,
      data: { action: "verify", nodeId: fixtureNodeId, token: "invalid-token" },
    });
    expect([200, 400, 404, 422, 502], `/nodes/pair verify returned ${verify.status()}`).toContain(
      verify.status(),
    );
    routeEvidence.verify = await responseShape(verify);

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

        const nodeNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await nodeNav.scrollIntoViewIfNeeded();
        await nodeNav.click();
        await expect(page.locator(".deck-ui-shell")).toHaveAttribute("data-active-panel", "nodes");
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("nodes-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByRole("button", { name: variant.refreshLabel })).toBeVisible();

        if (fixtureCreated) {
          await expect(panel.getByText(fixtureName).first()).toBeVisible({ timeout: 8000 });
        }
        const fixtureVisible = fixtureCreated
          ? await panel
              .getByText(fixtureName)
              .first()
              .isVisible()
              .catch(() => false)
          : false;
        const rejectButton = panel.getByRole("button", { name: variant.rejectPairingLabel });
        const rejectVisible = await rejectButton.isVisible().catch(() => false);
        if (rejectVisible) {
          await rejectButton.click();
          await expect(panel.getByRole("alertdialog")).toBeVisible();
          await panel.getByRole("button", { name: variant.cancelLabel }).click();
        }

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          directGateway,
          fixtureVisible,
          locale: variant.locale,
          navigation: "chat-to-nodes",
          rejectConfirmExercised: rejectVisible,
          theme: variant.theme,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }

    const cleanup =
      fixtureCreated && fixtureRequestId
        ? await request.post(`${stack.backendBase}/api/nodes/pair`, {
            headers: jsonHeaders,
            data: { action: "reject", requestId: fixtureRequestId },
          })
        : await request.post(`${stack.backendBase}/api/nodes/pair`, {
            headers: jsonHeaders,
            data: { action: "reject", requestId: buildRunScopedName(runId, "nonexistent-reject") },
          });
    expect([200, 400, 404, 422, 502], `/nodes/pair reject returned ${cleanup.status()}`).toContain(
      cleanup.status(),
    );
    routeEvidence.rejectCleanup = await responseShape(cleanup);

    const evidence: JsonObject = {
      routeEvidence,
      runId,
      scenarioId: "nodes.real.product-surface",
      status: fixtureCreated ? "passed" : "degraded",
      uiEvidence,
    };
    await writeRealE2EScenarioEvidence(stack, "nodes-real-product-surface", evidence, testInfo);
  });
});

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

function extractRequestId(payload?: JsonObject) {
  const request = payload?.request;
  if (request && typeof request === "object" && !Array.isArray(request)) {
    const requestId = (request as JsonObject).requestId;
    return typeof requestId === "string" ? requestId : undefined;
  }
  const requestId = payload?.requestId;
  return typeof requestId === "string" ? requestId : undefined;
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
    if (
      (url.startsWith(`${backendBase}/api/nodes`) ||
        url.startsWith(`${backendBase}/api/nodes/pair`)) &&
      status === 502
    ) {
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
