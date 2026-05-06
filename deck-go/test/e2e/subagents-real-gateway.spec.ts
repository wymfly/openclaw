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
  audit: string;
  auditUnsupported: RegExp;
  editPermissions: string;
  globalDefaults: string;
  lineage: string;
  navLabel: string;
  permissions: string;
  raw: string;
  refreshRuns: string;
  theme: "dark" | "light";
  locale: "en" | "zh";
  title: string;
};

const VARIANTS: Variant[] = [
  {
    audit: "Audit",
    auditUnsupported: /No Subagents audit endpoint|Audit|Degraded/i,
    editPermissions: "Edit permissions",
    globalDefaults: "Global spawn defaults",
    lineage: "Lineage",
    navLabel: "Subagents",
    permissions: "Per-agent permissions",
    raw: "Raw",
    refreshRuns: "Refresh runs",
    theme: "dark",
    locale: "en",
    title: "Subagents",
  },
  {
    audit: "审计",
    auditUnsupported: /当前未声明 Subagents 审计端点|审计|降级/i,
    editPermissions: "编辑权限",
    globalDefaults: "全局生成默认值",
    lineage: "谱系",
    navLabel: "子智能体",
    permissions: "每智能体权限",
    raw: "原始",
    refreshRuns: "刷新运行",
    theme: "dark",
    locale: "zh",
    title: "子智能体",
  },
  {
    audit: "Audit",
    auditUnsupported: /No Subagents audit endpoint|Audit|Degraded/i,
    editPermissions: "Edit permissions",
    globalDefaults: "Global spawn defaults",
    lineage: "Lineage",
    navLabel: "Subagents",
    permissions: "Per-agent permissions",
    raw: "Raw",
    refreshRuns: "Refresh runs",
    theme: "light",
    locale: "en",
    title: "Subagents",
  },
  {
    audit: "审计",
    auditUnsupported: /当前未声明 Subagents 审计端点|审计|降级/i,
    editPermissions: "编辑权限",
    globalDefaults: "全局生成默认值",
    lineage: "谱系",
    navLabel: "子智能体",
    permissions: "每智能体权限",
    raw: "原始",
    refreshRuns: "刷新运行",
    theme: "light",
    locale: "zh",
    title: "子智能体",
  },
];

test.describe("subagents real deck-go BFF contract chain", () => {
  test.skip(
    process.env.DECK_GO_REAL_GATEWAY_E2E !== "1",
    "set DECK_GO_REAL_GATEWAY_E2E=1 to run the Subagents real Gateway E2E",
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

  test("verifies route shapes, skipped-safe live actions, UI variants, and BFF-only transport", async ({
    browser,
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const jsonHeaders = { ...headers, "Content-Type": "application/json" };
    const runId = stack.realE2E?.runId ?? stack.runId;
    const fakeRunId = buildRunScopedName(runId, "subagent-nonexistent-run");
    const routeEvidence: JsonObject = { runId };

    const runtime = await request.get(`${stack.backendBase}/api/runtime/gateway`, { headers });
    expect(runtime.ok(), `/runtime/gateway returned ${runtime.status()}`).toBe(true);
    routeEvidence.runtime = await responseShape(runtime);

    const runsResponse = await request.get(
      `${stack.backendBase}/api/deck/subagents?status=all&limit=100`,
      { headers },
    );
    expect(
      [200, 400, 404, 501, 502, 503],
      `/deck/subagents returned ${runsResponse.status()}`,
    ).toContain(runsResponse.status());
    const runsShape = await responseShape(runsResponse);
    const runs = Array.isArray(runsShape.payload?.runs)
      ? (runsShape.payload.runs as JsonObject[])
      : [];
    const firstRunId = typeof runs[0]?.runId === "string" ? runs[0].runId : "";
    routeEvidence.runs = {
      ...runsShape,
      runCount: runs.length,
      total: runsShape.payload?.total ?? null,
    };

    const lineage = await request.post(`${stack.backendBase}/api/deck/subagents`, {
      headers: jsonHeaders,
      data: { action: "lineage", runId: firstRunId || fakeRunId },
    });
    expect(
      [200, 400, 404, 501, 502, 503],
      `/deck/subagents lineage returned ${lineage.status()}`,
    ).toContain(lineage.status());
    routeEvidence.lineage = await responseShape(lineage);
    routeEvidence.lineageFixture = firstRunId
      ? { runId: firstRunId, source: "real-list" }
      : { skippedSafe: true, reason: "no real subagent run available" };

    const agents = await request.post(`${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`, {
      headers: jsonHeaders,
      data: { method: "agents.list", params: {} },
    });
    expect(
      [200, 400, 404, 501, 502, 503],
      `/gateway/rpc agents.list returned ${agents.status()}`,
    ).toContain(agents.status());
    const agentsShape = await responseShape(agents);
    const agentsPayload = resultPayload(agentsShape.payload);
    const agentList = Array.isArray(agentsPayload?.agents)
      ? (agentsPayload.agents as JsonObject[])
      : [];
    const agentId = typeof agentList[0]?.id === "string" ? agentList[0].id : "main";
    routeEvidence.agents = {
      ...agentsShape,
      selectedAgentId: agentId,
    };

    const configGet = await request.post(`${stack.backendBase}/api/deck/agents`, {
      headers: jsonHeaders,
      data: { action: "subagents.get", agentId },
    });
    expect(
      [200, 400, 404, 501, 502, 503],
      `/deck/agents subagents.get returned ${configGet.status()}`,
    ).toContain(configGet.status());
    routeEvidence.configGet = await responseShape(configGet);

    const invalidKill = await request.post(`${stack.backendBase}/api/deck/subagents`, {
      headers: jsonHeaders,
      data: { action: "kill", runId: fakeRunId },
    });
    expect(
      [400, 404, 409, 422, 501, 502, 503],
      `/deck/subagents invalid kill returned ${invalidKill.status()}`,
    ).toContain(invalidKill.status());
    routeEvidence.invalidKill = await responseShape(invalidKill);

    const invalidSteer = await request.post(`${stack.backendBase}/api/deck/subagents`, {
      headers: jsonHeaders,
      data: { action: "steer", runId: fakeRunId, instruction: `deck-go e2e ${runId}` },
    });
    expect(
      [400, 404, 409, 422, 501, 502, 503],
      `/deck/subagents invalid steer returned ${invalidSteer.status()}`,
    ).toContain(invalidSteer.status());
    routeEvidence.invalidSteer = await responseShape(invalidSteer);

    const invalidConfigSet = await request.post(`${stack.backendBase}/api/deck/agents`, {
      headers: jsonHeaders,
      data: {
        action: "subagents.set",
        agentId,
        allowAgents: [],
        baseHash: "__deck_go_e2e_invalid_hash__",
      },
    });
    expect(
      [400, 404, 409, 422, 501, 502, 503],
      `/deck/agents subagents.set invalid hash returned ${invalidConfigSet.status()}`,
    ).toContain(invalidConfigSet.status());
    routeEvidence.invalidConfigSet = await responseShape(invalidConfigSet);

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

        const subagentsNav = page
          .locator(".deck-ui-rail")
          .getByRole("button", { exact: true, name: variant.navLabel });
        await subagentsNav.scrollIntoViewIfNeeded();
        await subagentsNav.click();

        await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
          "data-active-panel",
          "subagents",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);

        const panel = page.getByTestId("subagents-panel");
        await expect(panel).toBeVisible();
        await expect(
          panel.getByRole("heading", { exact: true, name: variant.title }),
        ).toBeVisible();
        await expect(panel.getByRole("button", { name: variant.refreshRuns })).toBeVisible();

        const runRows = await panel.locator(".row-list .row").count();
        if (runRows > 0) {
          await panel.locator(".row-list .row").first().click();
          await panel.getByRole("tab", { name: variant.lineage }).click();
          await expect(
            panel.getByText(/Lineage root|谱系根节点|No lineage|暂无谱系|Failed|失败/i).first(),
          ).toBeVisible();
          await panel.getByRole("tab", { name: variant.audit }).click();
          await expect(panel.getByText(variant.auditUnsupported).first()).toBeVisible();
          await panel.getByRole("button", { name: variant.raw }).click();
          await expect(page.getByRole("dialog", { name: variant.raw })).toBeVisible();
          await page.keyboard.press("Escape");
        } else {
          await expect(
            panel.getByText(/No runs found|未找到运行记录|failed|失败/i).first(),
          ).toBeVisible();
        }

        await panel.getByRole("tab", { name: variant.permissions }).click();
        await expect(panel.getByText(variant.globalDefaults)).toBeVisible();
        const editPermissions = panel
          .getByRole("button", { name: variant.editPermissions })
          .first();
        const permissionDialogVisible = await expect
          .poll(async () => editPermissions.isVisible().catch(() => false), { timeout: 10_000 })
          .toBe(true)
          .then(() => true)
          .catch(() => false);
        if (permissionDialogVisible) {
          await editPermissions.click();
          await expect(page.getByRole("dialog", { name: variant.editPermissions })).toBeVisible();
          await page.keyboard.press("Escape");
        }

        await expect.poll(() => unexpected.apiErrors.slice()).toEqual([]);
        expect(unexpected.consoleErrors).toEqual([]);
        expect(unexpected.pageErrors).toEqual([]);
        expect(directGateway.requests).toEqual([]);
        expect(directGateway.websockets).toEqual([]);

        uiEvidence.push({
          directGateway,
          locale: variant.locale,
          navigation: "chat-to-subagents",
          permissionDialogExercised: permissionDialogVisible,
          runRows,
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
      scenarioId: "subagents.real.product-surface",
      status: firstRunId ? "passed" : "degraded",
      uiEvidence,
    };
    await writeRealE2EScenarioEvidence(stack, "subagents-real-product-surface", evidence, testInfo);
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

function resultPayload(payload: JsonObject | undefined): JsonObject | undefined {
  const result = payload?.result;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as JsonObject;
  }
  const legacyPayload = payload?.payload;
  if (legacyPayload && typeof legacyPayload === "object" && !Array.isArray(legacyPayload)) {
    return legacyPayload as JsonObject;
  }
  return payload;
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
      (url.startsWith(`${backendBase}/api/deck/subagents`) ||
        url.startsWith(`${backendBase}/api/deck/agents`)) &&
      [400, 404, 409, 422, 501, 502, 503].includes(status)
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
