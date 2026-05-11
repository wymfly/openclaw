import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  authHeaders,
  createAgentFixture,
  deleteAgentFixture,
  openDeck,
  startRealGatewayStack,
  writeRealE2EScenarioEvidence,
  type AgentFixture,
  type E2EStack,
} from "./helpers";

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

  test("verifies agents API workflows through deck-go and real Gateway", async ({
    request,
  }, testInfo) => {
    const headers = authHeaders(stack.accessToken);
    const fixture = await createAgentFixture(request, stack, "agents-api", { model: "gpt-5.4" });

    try {
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
        "deck.agents.modelPolicy.get",
        "deck.agents.modelPolicy.set",
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

      const agents = await request.post(
        `${stack.backendBase}/api/v1/runtimes/rt_local/gateway/rpc`,
        {
          headers,
          data: { method: "agents.list", params: {} },
        },
      );
      expect(agents.ok(), `agents.list returned ${agents.status()}`).toBe(true);
      const agentsPayload = (await agents.json()) as {
        result?: { agents?: Array<{ id?: string }>; defaultId?: string };
      };
      const listedAgentIds = agentsPayload.result?.agents?.map((agent) => agent.id) ?? [];
      expect(listedAgentIds).toContain(fixture.id);

      const detail = await request.get(`${stack.backendBase}/api/deck/agents`, {
        headers,
        params: { agentId: fixture.id },
      });
      expect(detail.ok(), `deck agents detail returned ${detail.status()}`).toBe(true);
      await expect(detail.json()).resolves.toMatchObject({ id: fixture.id });

      const safeUpdate = await request.patch(
        `${stack.backendBase}/api/agents/${encodeURIComponent(fixture.id)}`,
        {
          headers,
          data: { emoji: "AE" },
        },
      );
      expect(safeUpdate.ok(), `fixture agents.update returned ${safeUpdate.status()}`).toBe(true);

      const protectedDelete = await request.delete(`${stack.backendBase}/api/agents?agentId=main`, {
        headers,
      });
      expect(
        protectedDelete.ok(),
        `main delete should be rejected, returned ${protectedDelete.status()}`,
      ).toBe(false);
      expect(protectedDelete.status()).toBeGreaterThanOrEqual(400);

      for (const action of [
        "skills.get",
        "subagents.get",
        "modelPolicy.get",
        "eventStreams.get",
        "toolPolicy.preview",
        "systemPrompt.preview",
      ]) {
        const response = await request.post(`${stack.backendBase}/api/deck/agents`, {
          headers,
          data: { action, agentId: fixture.id },
        });
        expect(response.ok(), `${action} returned ${response.status()}`).toBe(true);
        const payload = (await response.json()) as Record<string, unknown>;
        expect(Object.keys(payload).length, `${action} returned an empty object`).toBeGreaterThan(
          0,
        );
      }

      const policy = await postDeckAgentsJson(request, stack, {
        action: "modelPolicy.get",
        agentId: fixture.id,
      });
      expect(Array.isArray(policy.policies), "modelPolicy.get policies must be an array").toBe(
        true,
      );
      expect(
        Array.isArray(policy.configuredModels),
        "modelPolicy.get configuredModels must be an array",
      ).toBe(true);
      const configuredModel = (policy.configuredModels as Array<{ ref?: string }>).find(
        (model) => typeof model.ref === "string" && model.ref.length > 0,
      );
      const configuredRef = configuredModel?.ref;
      if (typeof configuredRef !== "string" || configuredRef.length === 0) {
        throw new Error("real modelPolicy test needs at least one configured model");
      }

      const savePolicy = await request.post(`${stack.backendBase}/api/deck/agents`, {
        headers,
        data: {
          action: "modelPolicy.set",
          target: { kind: "agent-model", key: "agent", agentId: fixture.id },
          selection: { primary: configuredRef },
          baseHash: policy.configHash,
        },
      });
      const saveText = await savePolicy.text();
      expect(savePolicy.ok(), `modelPolicy.set returned ${savePolicy.status()}: ${saveText}`).toBe(
        true,
      );

      const stalePolicy = await request.post(`${stack.backendBase}/api/deck/agents`, {
        headers,
        data: {
          action: "modelPolicy.set",
          target: { kind: "agent-model", key: "agent", agentId: fixture.id },
          selection: { primary: configuredRef },
          baseHash: "__deck_go_e2e_invalid_hash__",
        },
      });
      expect(
        [400, 404, 409, 422, 500, 502, 503],
        `modelPolicy.set stale hash returned ${stalePolicy.status()}`,
      ).toContain(stalePolicy.status());

      const files = await request.get(
        `${stack.backendBase}/api/agents/${encodeURIComponent(fixture.id)}/files`,
        { headers },
      );
      expect(files.ok(), `agent files returned ${files.status()}`).toBe(true);
      const filesPayload = (await files.json()) as { files?: unknown[] };
      expect(Array.isArray(filesPayload.files)).toBe(true);

      const identity = await request.get(
        `${stack.backendBase}/api/agents/${encodeURIComponent(fixture.id)}/identity`,
        { headers },
      );
      expect(identity.ok(), `agent identity returned ${identity.status()}`).toBe(true);
      await expect(identity.json()).resolves.toMatchObject({ agentId: fixture.id });

      await writeRealE2EScenarioEvidence(
        stack,
        "agents-api-fixture",
        {
          scenarioId: "agents-api-fixture",
          runId: fixture.runId,
          status: "passed",
          fixture: { id: fixture.id, name: fixture.name, workspace: fixture.workspace },
          methods: [
            "agents.list",
            "agents.create",
            "agents.update",
            "agents.delete",
            "deck.agents.modelPolicy.get",
            "deck.agents.modelPolicy.set",
            "deck.agents.*",
          ],
          modelPolicy: {
            selectedRef: configuredRef,
            staleHashStatus: stalePolicy.status(),
          },
          protectedMainDelete: { status: protectedDelete.status() },
        },
        testInfo,
      );
    } finally {
      await deleteAgentFixture(request, stack, fixture);
    }
  });

  test("renders agents UI variants through shell navigation", async ({
    browser,
    request,
  }, testInfo) => {
    const fixture = await createAgentFixture(request, stack, "agents-variants", {
      model: "gpt-5.4",
    });
    const variants = [
      {
        expectedTitle: "Agents",
        locale: "en" as const,
        navLabel: "Agents",
        theme: "dark" as const,
      },
      {
        expectedTitle: "智能体",
        locale: "zh" as const,
        navLabel: "智能体",
        theme: "light" as const,
      },
    ];

    try {
      for (const variant of variants) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const unexpected = recordUnexpected(page, stack.backendBase);
        try {
          await openDeck(page, stack.frontendBase, "chat", stack.accessToken, {
            locale: variant.locale,
            nav: "expanded",
            theme: variant.theme,
          });

          await page.getByRole("button", { exact: true, name: variant.navLabel }).click();
          await expect(page.locator(".deck-ui-shell")).toHaveAttribute(
            "data-active-panel",
            "agents",
          );
          await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);
          await expect(page.locator('[data-agents-workbench="true"] h1')).toHaveText(
            variant.expectedTitle,
          );
          await expect(page.getByText(fixture.id).first()).toBeVisible();
          await expect.poll(() => unexpected.slice()).toEqual([]);
        } finally {
          await context.close();
        }
      }

      await writeRealE2EScenarioEvidence(
        stack,
        "agents-ui-variants",
        {
          scenarioId: "agents-ui-variants",
          runId: fixture.runId,
          status: "passed",
          variants,
          fixture: { id: fixture.id },
        },
        testInfo,
      );
    } finally {
      await deleteAgentFixture(request, stack, fixture);
    }
  });

  test("exercises agents real detail sections and stable back navigation", async ({
    page,
    request,
  }, testInfo) => {
    const unexpected = recordUnexpected(page, stack.backendBase);
    const fixture = await createAgentFixture(request, stack, "agents-detail", {
      model: "gpt-5.4",
    });

    try {
      await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
        locale: "en",
        nav: "expanded",
        theme: "dark",
      });

      await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
      await page.getByText(fixture.id).first().click();
      await expect(page.getByLabel(`Agent detail for ${fixture.name}`)).toBeVisible();

      await exerciseAgentsDetailSections(page, fixture);

      await page.getByRole("button", { name: "Back to list" }).click();
      await expect(page.getByLabel(`Agent detail for ${fixture.name}`)).toBeHidden();
      await expect(page.locator(".agents-list")).toBeVisible();
      await page.waitForTimeout(1_500);
      await expect(page.locator(".agents-list")).toBeVisible();
      await expect(page.getByLabel(`Agent detail for ${fixture.name}`)).toBeHidden();

      await expect.poll(() => unexpected.slice()).toEqual([]);

      await writeRealE2EScenarioEvidence(
        stack,
        "agents-detail-sections",
        {
          scenarioId: "agents-detail-sections",
          runId: fixture.runId,
          status: "passed",
          fixture: { id: fixture.id },
          sections: [
            "Overview",
            "Skills",
            "Subagents",
            "Tool policy",
            "System prompt",
            "Files",
            "Event streams",
          ],
        },
        testInfo,
      );
    } finally {
      await deleteAgentFixture(request, stack, fixture);
    }
  });
});

async function exerciseAgentsDetailSections(page: Page, fixture: AgentFixture) {
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.getByLabel("Emoji").fill("DG");
  await expect(page.getByRole("button", { name: "Save changes" }).first()).toBeEnabled();

  await clickDetailTab(page, "Runtime");
  await expect(page.getByText("Model source")).toBeVisible();
  await expect(page.getByText("Workspace source")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Model usage policy" })).toBeVisible();
  await expect(page.getByText("Agent runtime model")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and save" })).toBeVisible();

  await clickDetailTab(page, "Skills");
  await expect(
    page.getByLabel("Skill mode", { exact: true }).getByRole("tab", { name: "All" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: "Skills" })).toBeVisible();

  await clickDetailTab(page, "Subagents");
  await expect(page.getByText(/model policy now lives/i)).toBeVisible();
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: "Subagents" })).toBeVisible();

  await clickDetailTab(page, "Tool policy");
  await page.getByRole("button", { name: "Recompute" }).click();
  await expect(page.getByRole("heading", { name: "Tool policy" })).toBeVisible();

  await clickDetailTab(page, "System prompt");
  await page.getByRole("button", { name: "Recompute" }).click();
  await expect(page.getByRole("heading", { name: "System prompt" })).toBeVisible();

  await clickDetailTab(page, "Files");
  await page.getByLabel("File name").fill("MEMORY.md");
  await page.getByLabel("File content").fill(`real e2e note for ${fixture.id}`);
  const saveFileButton = page.getByRole("button", { name: "Save changes" }).last();
  await expect(saveFileButton).toBeEnabled();
  await saveFileButton.click();
  await expect(page.getByText("Could not save")).toBeHidden();

  await clickDetailTab(page, "Event streams");
  await expect(
    page.getByRole("switch", { name: "Toggle stream agent.status.changed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: "Event streams" })).toBeVisible();

  await clickDetailTab(page, "Routing impact");
  await expect(page.getByRole("button", { name: "Open Routing" })).toBeVisible();

  await clickDetailTab(page, "Danger zone");
  await expect(page.getByRole("button", { name: "Delete agent" }).first()).toBeVisible();
}

async function clickDetailTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name }).first();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

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

async function postDeckAgentsJson(
  request: APIRequestContext,
  stack: E2EStack,
  data: Record<string, unknown>,
) {
  const response = await request.post(`${stack.backendBase}/api/deck/agents`, {
    headers: authHeaders(stack.accessToken),
    data,
  });
  const text = await response.text();
  const action = typeof data.action === "string" ? data.action : "unknown-action";
  expect(response.ok(), `/deck/agents ${action} returned ${response.status()}: ${text}`).toBe(true);
  return JSON.parse(text) as Record<string, unknown>;
}
