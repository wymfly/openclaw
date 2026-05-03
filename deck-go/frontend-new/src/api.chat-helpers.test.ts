import { afterEach, describe, expect, it, vi } from "vitest";

const deckFetchMock = vi.fn();
const deckStreamMock = vi.fn();
const createDeckGatewayClientMock = vi.fn();

vi.mock("./lib/deck-client", () => ({
  deckFetch: (...args: unknown[]) => deckFetchMock(...args),
  deckStream: (...args: unknown[]) => deckStreamMock(...args),
}));

vi.mock("./lib/gateway-client", () => ({
  createDeckGatewayClient: (...args: unknown[]) => createDeckGatewayClientMock(...args),
}));

import {
  addRoutingBinding,
  approveDeviceRequest,
  approveNodePairing,
  branchCompactionCheckpoint,
  compactChatSession,
  createAgent,
  createCronJob,
  deleteAgent,
  deleteDoc,
  describeNode,
  fetchCompactionCheckpoints,
  fetchCronJobs,
  fetchCronRuns,
  fetchCronStatus,
  fetchAgentDetail,
  fetchAgentFile,
  fetchAgentFiles,
  fetchAgentIdentity,
  fetchAgentsList,
  fetchDevices,
  fetchIdentityLinks,
  extractDocs,
  fetchDoc,
  fetchDocs,
  fetchLogsTail,
  fetchMonitorStats,
  fetchPluginsWithCapability,
  fetchPluginApprovals,
  fetchSkillHubBins,
  fetchSkillHubDetail,
  fetchSelfDevice,
  fetchSettingsVersion,
  fetchRoutingBindings,
  fetchRuntimeConfiguredModels,
  fetchRuntimeGatewayStatus,
  fetchMonitorRunDetail,
  fetchMonitorRuns,
  fetchRuntimeModelAuthOverview,
  fetchRuntimeModelCatalogProviders,
  fetchSessions,
  installSkill,
  installSkillHub,
  linkIdentityPeer,
  enqueueNodePendingWork,
  invokeNodeCommand,
  probeRuntimeModelAuth,
  fetchSubagentLineage,
  fetchSubagentRuns,
  fetchToolsCatalog,
  fetchThreads,
  fetchUsageSessionLogs,
  fetchUsageSessions,
  fetchUsageTimeseries,
  evaluateBudgetRules,
  patchChatSession,
  persistChatProjection,
  resolveCanvasEval,
  resolvePluginApproval,
  rejectNodePairing,
  unlinkIdentityPeer,
  rejectDeviceRequest,
  removeRoutingBinding,
  removeDevice,
  renameNode,
  revokeDeviceToken,
  rotateDeviceToken,
  runCronJob,
  setCanvasBridgeReady,
  searchMemory,
  searchSkillHub,
  simulateRouting,
  restoreCompactionCheckpoint,
  saveAgentFile,
  updateApprovalsPolicy,
  updateAgentRawConfig,
  updateAgent,
  updateAlertRule,
  updateBudgetRule,
  updateCronJob,
  updateSkillHub,
  updateWebhook,
  validateRoutingBinding,
  verifyNodePairing,
  testSettingsConnection,
} from "./api";

afterEach(() => {
  vi.clearAllMocks();
});

function mockGatewayClient(overrides: Record<string, unknown> = {}) {
  const client = {
    agents: {
      list: vi.fn().mockResolvedValue({ agents: [{ id: "main" }], defaultId: "main" }),
    },
    deck: {
      auth: {
        overview: vi.fn().mockResolvedValue({ providers: [] }),
        probe: vi.fn().mockResolvedValue({
          provider: "openai",
          source: "env",
          label: "OpenAI",
          status: "ok",
        }),
      },
    },
    models: {
      catalog: {
        providers: vi.fn().mockResolvedValue({ providers: [] }),
      },
      configured: vi.fn().mockResolvedValue({ models: [] }),
    },
    ...overrides,
  };
  createDeckGatewayClientMock.mockReturnValue(client);
  return client;
}

describe("chat helper seam requests", () => {
  it("passes session list filters through to the current sessions route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ sessions: [] }), { status: 200 }),
    );

    await fetchSessions({
      agentId: "main",
      search: "handoff",
      limit: 25,
      activeMinutes: 60,
    });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/sessions?agentId=main&search=handoff&limit=25&activeMinutes=60",
      undefined,
    );
  });

  it("posts chat compaction to the compact endpoint", async () => {
    deckFetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await compactChatSession("sess-1");

    expect(deckFetchMock).toHaveBeenCalledWith("/api/chat/compact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: "sess-1" }),
    });
  });

  it("posts compaction checkpoint list, branch, and restore actions to the compaction endpoint", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ checkpoints: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await fetchCompactionCheckpoints("sess-1");
    await branchCompactionCheckpoint("sess-1", "cp-1");
    await restoreCompactionCheckpoint("sess-1", "cp-1");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/chat/compaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list", key: "sess-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/chat/compaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "branch", key: "sess-1", checkpointId: "cp-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/chat/compaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", key: "sess-1", checkpointId: "cp-1" }),
    });
  });

  it("fetches configured runtime models through the typed gateway client", async () => {
    const client = mockGatewayClient();

    await expect(fetchRuntimeConfiguredModels()).resolves.toMatchObject({
      runtimeId: "rt_local",
      payload: { models: [] },
    });
    expect(createDeckGatewayClientMock).toHaveBeenCalledWith({ runtimeId: "rt_local" });
    expect(client.models.configured).toHaveBeenCalledWith({});
    expect(deckFetchMock).not.toHaveBeenCalled();
  });

  it("fetches runtime model auth, catalog providers, and probe through the typed gateway client", async () => {
    const client = mockGatewayClient();

    await fetchRuntimeModelAuthOverview("rt_custom");
    await fetchRuntimeModelCatalogProviders();
    await probeRuntimeModelAuth("openai");

    expect(createDeckGatewayClientMock).toHaveBeenNthCalledWith(1, { runtimeId: "rt_custom" });
    expect(createDeckGatewayClientMock).toHaveBeenNthCalledWith(2, { runtimeId: "rt_local" });
    expect(createDeckGatewayClientMock).toHaveBeenNthCalledWith(3, { runtimeId: "rt_local" });
    expect(client.deck.auth.overview).toHaveBeenCalledWith({});
    expect(client.models.catalog.providers).toHaveBeenCalledWith({});
    expect(client.deck.auth.probe).toHaveBeenCalledWith({ provider: "openai" });
    expect(deckFetchMock).not.toHaveBeenCalled();
  });

  it("passes plugin capability filters through the deck plugins route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ scope: "channel", plugins: [] }), { status: 200 }),
    );
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ scope: "channel", plugins: [] }), { status: 200 }),
    );

    await fetchPluginsWithCapability();
    await fetchPluginsWithCapability("all");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/deck/plugins", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/deck/plugins?capability=all", undefined);
  });

  it("posts node pairing decisions with Gateway requestId and verify token fields", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await approveNodePairing("req-1");
    await rejectNodePairing("req-2");
    await verifyNodePairing("node-1", "token-1");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/nodes/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", requestId: "req-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/nodes/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", requestId: "req-2" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/nodes/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", nodeId: "node-1", token: "token-1" }),
    });
  });

  it("posts node describe and rename with Gateway node fields", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await describeNode("node-1");
    await renameNode("node-1", "Renamed Node");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "describe", nodeId: "node-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rename",
        nodeId: "node-1",
        displayName: "Renamed Node",
      }),
    });
  });

  it("posts node invoke and pending enqueue through the current node action route", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ queued: { id: "pending-1" } }), {
          status: 200,
        }),
      );

    await invokeNodeCommand("node-1", "system.notify", { title: "Deck" }, 5000);
    await enqueueNodePendingWork({
      nodeId: "node-1",
      priority: "high",
      type: "status.request",
      wake: true,
    });

    const invokeInit = deckFetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(typeof invokeInit.body).toBe("string");
    const invokeBody = JSON.parse(invokeInit.body as string) as Record<string, unknown>;
    expect(deckFetchMock.mock.calls[0]?.[0]).toBe("/api/nodes");
    expect(invokeInit.method).toBe("POST");
    expect(invokeInit.headers).toEqual({ "Content-Type": "application/json" });
    expect(invokeBody).toMatchObject({
      action: "invoke",
      command: "system.notify",
      nodeId: "node-1",
      params: { title: "Deck" },
      timeoutMs: 5000,
    });
    expect(String(invokeBody.idempotencyKey)).toMatch(/^deck-go-/u);

    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pending.enqueue",
        nodeId: "node-1",
        priority: "high",
        type: "status.request",
        wake: true,
      }),
    });
  });

  it("routes agent inventory, files, identity, and tools catalog through the current agent facade", async () => {
    const gatewayClient = mockGatewayClient();
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ agentId: "main" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ops" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: "hello" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agentId: "main", name: "Main" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ tools: [] }), { status: 200 }));

    await fetchAgentsList();
    await fetchAgentDetail("main");
    await createAgent({
      avatar: "ops.png",
      emoji: ":gear:",
      name: "Ops",
      workspace: "/tmp/work",
    });
    await updateAgent("main", { name: "Renamed Main" });
    await deleteAgent("ops");
    await fetchAgentFiles("main");
    await saveAgentFile("main", "AGENTS.md", "hello");
    await fetchAgentFile("main", "notes/README.md");
    await fetchAgentIdentity("main");
    await fetchToolsCatalog("main");

    expect(createDeckGatewayClientMock).toHaveBeenCalledWith({ runtimeId: "rt_local" });
    expect(gatewayClient.agents.list).toHaveBeenCalledWith({});
    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/deck/agents?agentId=main", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        avatar: "ops.png",
        emoji: ":gear:",
        name: "Ops",
        workspace: "/tmp/work",
      }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/agents/main", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed Main" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(4, "/api/agents?agentId=ops", {
      method: "DELETE",
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(5, "/api/agents/main/files", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(6, "/api/agents/main/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "AGENTS.md", content: "hello" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(
      7,
      "/api/agents/main/files/notes%2FREADME.md",
      undefined,
    );
    expect(deckFetchMock).toHaveBeenNthCalledWith(8, "/api/agents/main/identity", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(9, "/api/tools/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "main" }),
    });
  });

  it("routes identity list/link/unlink with the required config base hash", async () => {
    deckFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ links: [], configHash: "hash-1" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await fetchIdentityLinks();
    await linkIdentityPeer("user:1", "telegram", "42", "hash-1");
    await unlinkIdentityPeer("user:1", "telegram", "42", "hash-2");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/deck/identity", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/deck/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "link",
        canonical: "user:1",
        channel: "telegram",
        peerId: "42",
        baseHash: "hash-1",
      }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/deck/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unlink",
        canonical: "user:1",
        channel: "telegram",
        peerId: "42",
        baseHash: "hash-2",
      }),
    });
  });

  it("routes docs list, detail, extract, and delete through the current docs API", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ docs: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "doc/1" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ extracted: 0, docs: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await fetchDocs({ category: "spec", query: " api " });
    await fetchDoc("doc/1");
    await extractDocs("sess-1");
    await deleteDoc("doc/1");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/docs?category=spec&q=api", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/docs/doc%2F1", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/docs/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: "sess-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(4, "/api/docs/doc%2F1", {
      method: "DELETE",
    });
  });

  it("routes deck routing helpers through Gateway-shaped actions and filters", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const match = {
      channel: "discord",
      accountId: "acct-1",
      peer: { kind: "direct" as const, id: "peer-1" },
      roles: ["admin"],
    };

    await fetchRoutingBindings({ agentId: " main ", channel: " discord ", accountId: " acct-1 " });
    await validateRoutingBinding({ agentId: "main", match });
    await addRoutingBinding({
      agentId: "main",
      match,
      baseHash: "hash-1",
      comment: "route support",
      position: 2,
    });
    await removeRoutingBinding({ id: "bind-1", baseHash: "hash-2" });
    await simulateRouting({
      channel: "discord",
      accountId: "acct-1",
      peer: { kind: "direct", id: "peer-1" },
      guildId: "guild-1",
      teamId: "team-1",
      memberRoleIds: ["admin", "ops"],
    });

    expect(deckFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/deck/routing?agentId=main&channel=discord&accountId=acct-1",
      undefined,
    );
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", agentId: "main", match }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        agentId: "main",
        match,
        baseHash: "hash-1",
        comment: "route support",
        position: 2,
      }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(4, "/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", id: "bind-1", baseHash: "hash-2" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(5, "/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "simulate",
        channel: "discord",
        accountId: "acct-1",
        peer: { kind: "direct", id: "peer-1" },
        guildId: "guild-1",
        teamId: "team-1",
        memberRoleIds: ["admin", "ops"],
      }),
    });
  });

  it("returns a raw response for patchChatSession", async () => {
    const response = new Response("{}", { status: 200 });
    deckFetchMock.mockResolvedValueOnce(response);

    await expect(patchChatSession({ sessionKey: "sess-1", fastMode: true })).resolves.toBe(
      response,
    );
    expect(deckFetchMock).toHaveBeenCalledWith("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: "sess-1", fastMode: true }),
    });
  });

  it("strips bridge-only A2UI fields before persisting projection state", async () => {
    deckFetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await persistChatProjection({
      sessionKey: "sess-1",
      a2uiState: {
        visible: true,
        url: "https://example.com/frame",
        bridgeStatus: "ready",
        surfaces: ["summary"],
        treeData: { ignored: true },
      },
    });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/chat/projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionKey: "sess-1",
        a2uiState: {
          visible: true,
          url: "https://example.com/frame",
          surfaces: ["summary"],
        },
      }),
    });
  });

  it("maps canvas bridge readiness to ready and unready actions", async () => {
    deckFetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await setCanvasBridgeReady({ sessionKey: "sess-1", ready: true });
    await setCanvasBridgeReady({ sessionKey: "sess-1", ready: false });

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/deck/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ready", sessionKey: "sess-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/deck/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unready", sessionKey: "sess-1" }),
    });
  });

  it("posts canvas eval resolution with the resolve action", async () => {
    deckFetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await resolveCanvasEval({ evalId: "eval-1", result: { ok: true, value: 42 } });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/deck/canvas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resolve",
        evalId: "eval-1",
        result: { ok: true, value: 42 },
      }),
    });
  });

  it("posts subagent lineage lookup through the current deck subagents action route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          root: { sessionKey: "sess-1", agentId: "main" },
          nodes: [],
        }),
        { status: 200 },
      ),
    );

    await fetchSubagentLineage({ sessionKey: "sess-1" });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/deck/subagents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lineage", sessionKey: "sess-1" }),
    });
  });

  it("passes subagent list filters through the current deck subagents route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ runs: [], total: 0 }), { status: 200 }),
    );

    await fetchSubagentRuns({
      agentId: "reviewer",
      limit: 100,
      offset: 20,
      requesterAgentId: "main",
      status: "completed",
    });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/deck/subagents?status=completed&agentId=reviewer&requesterAgentId=main&limit=100&offset=20",
      undefined,
    );
  });

  it("passes usage session filters through to the current usage route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ sessions: [], totals: { totalTokens: 0 } }), { status: 200 }),
    );

    await fetchUsageSessions({
      endDate: "2026-04-24",
      includeContextWeight: true,
      key: "sess-1",
      limit: 20,
      startDate: "2026-04-01",
    });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/usage/sessions?startDate=2026-04-01&endDate=2026-04-24&key=sess-1&includeContextWeight=true&limit=20",
      undefined,
    );
  });

  it("fetches usage session logs through the current usage logs route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ logs: [] }), { status: 200 }),
    );

    await fetchUsageSessionLogs({ key: "sess-1", limit: 50 });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/usage/sessions/logs?key=sess-1&limit=50",
      undefined,
    );
  });

  it("fetches usage timeseries through the current usage timeseries route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ points: [] }), { status: 200 }),
    );

    await fetchUsageTimeseries({
      endDate: "2026-04-24",
      key: "sess-1",
      mode: "daily",
      startDate: "2026-04-01",
      utcOffset: "+08:00",
    });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/usage/timeseries?key=sess-1&startDate=2026-04-01&endDate=2026-04-24&mode=daily&utcOffset=%2B08%3A00",
      undefined,
    );
  });

  it("passes only supported logs tail cursor parameters to the current logs route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ cursor: 12, lines: [] }), { status: 200 }),
    );

    await fetchLogsTail({ cursor: 7, limit: 200, maxBytes: 65536 });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/logs?cursor=7&limit=200&maxBytes=65536",
      undefined,
    );
  });

  it("passes thread filters through to the current deck threads route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ threads: [] }), { status: 200 }),
    );

    await fetchThreads({ agentId: " main ", channel: " discord ", status: "all" });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/deck/threads?agentId=main&channel=discord&status=all",
      undefined,
    );
  });

  it("routes plugin approval list and resolution through the current approvals plugin routes", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await fetchPluginApprovals();
    await resolvePluginApproval("plugin-ap-1", "allow-once");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/approvals/plugins", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/approvals/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "plugin-ap-1", decision: "allow-once" }),
    });
  });

  it("puts approval policy edits through the current approvals policy route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await updateApprovalsPolicy(
      {
        defaults: { security: "deny", ask: "always" },
        agents: { main: { security: "full" } },
        allowlist: ["pwd"],
      },
      "policy-hash",
    );

    expect(deckFetchMock).toHaveBeenCalledWith("/api/approvals/policy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: {
          defaults: { security: "deny", ask: "always" },
          agents: { main: { security: "full" } },
          allowlist: ["pwd"],
        },
        baseHash: "policy-hash",
      }),
    });
  });

  it("posts skill installs through the current skills install route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await installSkill("GitHub", "brew-gh");

    expect(deckFetchMock).toHaveBeenCalledWith("/api/skills/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "GitHub", installId: "brew-gh" }),
    });
  });

  it("passes ClawHub skill actions through the current skills hub route", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ bins: ["dev"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ skill: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await fetchSkillHubBins();
    await searchSkillHub("tool", 5);
    await fetchSkillHubDetail("test-skill");
    await installSkillHub("test-skill", "1.0.0");
    await updateSkillHub();

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/skills/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bins" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/skills/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "search", query: "tool", limit: 5 }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/skills/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detail", slug: "test-skill" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(4, "/api/skills/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "install", slug: "test-skill", version: "1.0.0" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(5, "/api/skills/hub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update" }),
    });
  });

  it("passes device inventory and token actions through the current devices routes", async () => {
    deckFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ paired: [], pending: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deviceId: "dev-self" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "next-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await fetchDevices();
    await fetchSelfDevice();
    await approveDeviceRequest("req-1");
    await rejectDeviceRequest("req-1");
    await removeDevice("dev-1");
    await rotateDeviceToken("dev-1", "operator");
    await revokeDeviceToken("dev-1", "operator");

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/devices", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/devices/self", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/devices/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "req-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(4, "/api/devices/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "req-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(5, "/api/devices/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev-1" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(6, "/api/devices/token/rotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev-1", role: "operator" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(7, "/api/devices/token/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "dev-1", role: "operator" }),
    });
  });

  it("passes settings connection and version requests through the current settings routes", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deck: "deck-v1", gateway: "gateway-v1", cli: "cli-v1" }), {
          status: 200,
        }),
      );

    await testSettingsConnection("ws://127.0.0.1:18789", "gateway-token");
    await fetchSettingsVersion();

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/settings/test-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "ws://127.0.0.1:18789", token: "gateway-token" }),
    });
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/settings/version", undefined);
  });

  it("wraps the read-only runtime gateway status route for Deck UI state", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mode: "bundled", status: "running" }), { status: 200 }),
    );

    const result = await fetchRuntimeGatewayStatus();

    expect(deckFetchMock).toHaveBeenNthCalledWith(1, "/api/runtime/gateway", undefined, {
      allowPrompt: false,
    });
    expect(result.runtime.status).toBe("running");
    expect(result.runtime.mode).toBe("bundled");
  });

  it("passes monitor run list, detail, and stats requests through the current monitor routes", async () => {
    deckFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runs: [], nextCursor: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ summary: null, events: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            avgDurationMs: 0,
            todayRuns: 0,
            topAgents: [],
            totalRuns: 0,
          }),
          { status: 200 },
        ),
      );

    await fetchMonitorRuns({
      agentId: "main",
      cursor: "run-0",
      limit: 25,
      sessionKey: "agent:main:web",
      status: "completed",
    });
    await fetchMonitorRunDetail("run/1");
    await fetchMonitorStats();

    expect(deckFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/monitor/runs?limit=25&agentId=main&cursor=run-0&sessionKey=agent%3Amain%3Aweb&status=completed",
      undefined,
    );
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/monitor/runs/run%2F1", undefined);
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/monitor/stats", undefined);
  });

  it("patches budget rule edits through the current usage budget route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "budget-1" }), { status: 200 }),
    );

    await updateBudgetRule("budget/1", { enabled: false, warnThreshold: 10 });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/usage/budget/budget%2F1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false, warnThreshold: 10 }),
    });
  });

  it("normalizes budget evaluation currentValue from the Go usage budget route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          evaluations: [
            {
              ruleId: "budget-1",
              ruleName: "Monthly cost",
              status: "warn",
              currentValue: 12,
              warnThreshold: 10,
              overThreshold: 20,
              dimension: "cost",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(evaluateBudgetRules()).resolves.toEqual({
      evaluations: [
        {
          ruleId: "budget-1",
          ruleName: "Monthly cost",
          status: "warn",
          current: 12,
          warnThreshold: 10,
          overThreshold: 20,
          dimension: "cost",
        },
      ],
    });
    expect(deckFetchMock).toHaveBeenCalledWith("/api/usage/budget/evaluate", undefined);
  });

  it("patches alert rule edits through the current alerts route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ rule: { id: "alert-1" } }), { status: 200 }),
    );

    await updateAlertRule("alert/1", { enabled: true, threshold: 90 });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/alerts/alert%2F1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, threshold: 90 }),
    });
  });

  it("patches webhook edits through the current webhooks route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "webhook-1" }), { status: 200 }),
    );

    await updateWebhook("webhook/1", {
      name: "Usage edited",
      events: ["agent.updated", "alert.fired"],
      enabled: false,
    });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/webhooks/webhook%2F1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Usage edited",
        events: ["agent.updated", "alert.fired"],
        enabled: false,
      }),
    });
  });

  it("creates cron jobs through the current cron route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), { status: 200 }),
    );

    await createCronJob({
      name: "Daily review",
      schedule: { kind: "cron", expr: "0 8 * * *" },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "brief me" },
      description: "Daily prompt",
      enabled: true,
    });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/cron", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Daily review",
        schedule: { kind: "cron", expr: "0 8 * * *" },
        sessionTarget: "isolated",
        wakeMode: "now",
        payload: { kind: "agentTurn", message: "brief me" },
        description: "Daily prompt",
        enabled: true,
      }),
    });
  });

  it("patches cron jobs through the current cron route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "job-1" }), { status: 200 }),
    );

    await updateCronJob("job/1", {
      enabled: false,
      schedule: { kind: "every", everyMs: 120000 },
    });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/cron/job%2F1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: false,
        schedule: { kind: "every", everyMs: 120000 },
      }),
    });
  });

  it("passes cron list, run history, and manual run options through the current cron route", async () => {
    deckFetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobs: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await fetchCronJobs({
      limit: 10,
      offset: 5,
      query: " nightly ",
      enabled: "enabled",
      sortBy: "name",
      sortDir: "asc",
      includeDisabled: true,
    });
    await fetchCronRuns("job/1", {
      limit: 20,
      offset: 5,
      sortDir: "desc",
      statuses: ["ok", "error"],
    });
    await runCronJob("job/1", { mode: "force" });

    expect(deckFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/cron?limit=10&offset=5&query=nightly&enabled=enabled&sortBy=name&sortDir=asc&includeDisabled=true",
      undefined,
    );
    expect(deckFetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/cron/job%2F1/runs?limit=20&offset=5&sortDir=desc&statuses=ok%2Cerror",
      undefined,
    );
    expect(deckFetchMock).toHaveBeenNthCalledWith(3, "/api/cron/job%2F1/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "force" }),
    });
  });

  it("normalizes generated cron status fields through the current cron route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          enabled: true,
          jobs: 3,
          nextWakeAtMs: 12345,
          storePath: "/tmp/mock-cron.json",
        }),
        { status: 200 },
      ),
    );

    await expect(fetchCronStatus()).resolves.toMatchObject({
      running: true,
      jobCount: 3,
      nextRunAtMs: 12345,
      storePath: "/tmp/mock-cron.json",
    });
    expect(deckFetchMock).toHaveBeenCalledWith("/api/cron/status", undefined);
  });

  it("normalizes generated cron job state fields through the current cron route", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: "job-1",
              name: "Daily review",
              schedule: { kind: "cron", expr: "0 8 * * *" },
              sessionTarget: "main",
              wakeMode: "now",
              payload: { kind: "systemEvent", text: "daily.review" },
              enabled: true,
              state: { nextRunAtMs: 12345 },
              updatedAtMs: 1,
              createdAtMs: 1,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(fetchCronJobs({ includeDisabled: true })).resolves.toMatchObject({
      jobs: [{ id: "job-1", nextRunAtMs: 12345 }],
    });
    expect(deckFetchMock).toHaveBeenCalledWith("/api/cron?includeDisabled=true", undefined);
  });

  it("passes memory search filters and preserves degraded 501 responses", async () => {
    deckFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ path: "memory.md", relevance: 0.9 }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not implemented — requires LanceDB extension" }), {
          status: 501,
        }),
      );

    await expect(
      searchMemory({ query: "remembered context", agentId: "main", scope: "global" }),
    ).resolves.toMatchObject({
      results: [{ path: "memory.md", relevance: 0.9 }],
      lanceDbEnabled: true,
      unavailableReason: null,
    });
    await expect(searchMemory({ query: "vectors", scope: "all" })).resolves.toMatchObject({
      results: [],
      unavailableReason: "Not implemented — requires LanceDB extension",
      lanceDbEnabled: false,
    });

    expect(deckFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/memory/search?q=remembered+context&agentId=main&scope=global",
      undefined,
    );
    expect(deckFetchMock).toHaveBeenNthCalledWith(2, "/api/memory/search?q=vectors", undefined);
  });
});

describe("agent config helper seam requests", () => {
  it("posts a single id-merged agents.list entry for raw agent config updates", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await updateAgentRawConfig("main", {
      entry: {
        id: "main",
        model: { primary: "gpt-5.4", fallbacks: ["gpt-5.4-mini"] },
        params: { temperature: 0.3 },
      },
      updates: {
        model: { primary: "gpt-5.4-mini", fallbacks: ["gpt-5.4-mini"] },
        params: { temperature: 0.6 },
        tools: { deny: null },
      },
      baseHash: "config-hash-1",
    });

    expect(deckFetchMock).toHaveBeenCalledWith("/api/config/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patch: {
          agents: {
            list: [
              {
                id: "main",
                model: { primary: "gpt-5.4-mini", fallbacks: ["gpt-5.4-mini"] },
                params: { temperature: 0.6 },
                tools: { deny: null },
              },
            ],
          },
        },
        baseHash: "config-hash-1",
      }),
    });
  });
});
