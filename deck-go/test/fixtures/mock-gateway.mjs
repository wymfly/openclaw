import fs from "node:fs";
import http from "node:http";
import { WebSocketServer } from "ws";

const protocolVersion = 3;
const defaultToken = "mock-gateway-token";

function response(id, payload) {
  return { type: "res", id, payload };
}

function responseError(id, code, message) {
  return { type: "res", id, error: { code, message } };
}

function defaultMethods() {
  const now = Date.now();
  const logCursor = 4208;
  const logLines = [
    `${new Date(now - 42_000).toISOString()} [INFO] [gateway] gateway ready sessionKey=sess-main bind=127.0.0.1:18789 runtime=bundled`,
    {
      timestamp: new Date(now - 36_000).toISOString(),
      level: "warn",
      source: "agent",
      sessionKey: "sess-build",
      message: "tool retry scheduled sessionKey=sess-build method=deck.agents.chat.start attempt=2",
    },
    `${new Date(now - 29_000).toISOString()} [DEBUG] [channel] websocket heartbeat acknowledged sessionKey=sess-main channel=discord account=ops-bot`,
    {
      timestamp: new Date(now - 22_000).toISOString(),
      level: "error",
      source: "agent",
      sessionKey: "sess-build",
      message:
        'agent handoff failed sessionKey=sess-build reason="mock upstream timeout for visual fixture"',
    },
    `${new Date(now - 12_000).toISOString()} [INFO] [gateway] logs.tail served cursor=${logCursor} sessionKey=sess-main`,
  ];
  const subagentRuns = [
    {
      runId: "run-root",
      childSessionKey: "agent:builder:web-root",
      childAgentId: "builder",
      childAgentName: "Builder Agent",
      requesterSessionKey: "agent:main:web-main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Implement the contract chain smoke test and report drift.",
      model: "openai/gpt-5.4",
      spawnMode: "delegate",
      depth: 1,
      createdAt: now - 260_000,
      startedAt: now - 250_000,
      durationMs: 250_000,
      status: "active",
    },
    {
      runId: "run-review",
      childSessionKey: "agent:reviewer:web-review",
      childAgentId: "reviewer",
      childAgentName: "Reviewer Agent",
      requesterSessionKey: "agent:builder:web-root",
      requesterAgentId: "builder",
      requesterAgentName: "Builder Agent",
      task: "Review gateway adapter notes for unsupported schema gaps.",
      model: "openai/gpt-5.4-mini",
      spawnMode: "delegate",
      depth: 2,
      createdAt: now - 190_000,
      startedAt: now - 180_000,
      durationMs: 120_000,
      endedAt: now - 60_000,
      status: "completed",
      outcome: { ok: true },
    },
    {
      runId: "run-qa",
      childSessionKey: "agent:qa:web-visual",
      childAgentId: "qa",
      childAgentName: "QA Agent",
      requesterSessionKey: "agent:main:web-main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Run focused Playwright mock visual verification.",
      model: "openai/gpt-5.4-mini",
      spawnMode: "delegate",
      depth: 1,
      createdAt: now - 420_000,
      startedAt: now - 410_000,
      durationMs: 124_000,
      endedAt: now - 286_000,
      status: "completed",
    },
    {
      runId: "run-security",
      childSessionKey: "agent:security:web-risk",
      childAgentId: "security",
      childAgentName: "Security Agent",
      requesterSessionKey: "agent:ops:web-incident",
      requesterAgentId: "ops",
      requesterAgentName: "Ops Runner",
      task: "Check capability boundary risk and handoff unresolved items.",
      model: "openai/gpt-5.4",
      spawnMode: "delegate",
      depth: 1,
      createdAt: now - 980_000,
      startedAt: now - 970_000,
      durationMs: 900_000,
      endedAt: now - 70_000,
      status: "timeout",
    },
  ];
  return {
    "gateway.describe": () => ({
      version: "mock-gateway",
      gatewayVersion: "mock-gateway",
      protocol: protocolVersion,
    }),
    health: () => ({ status: "healthy" }),
    status: () => ({ status: "running", health: "healthy" }),
    "logs.tail": (params) => {
      const cursor = Number.isFinite(params?.cursor) ? Number(params.cursor) : 0;
      const limit = Number.isFinite(params?.limit)
        ? Math.max(0, Number(params.limit))
        : logLines.length;
      return {
        cursor: logCursor,
        lines: cursor >= logCursor ? [] : logLines.slice(-limit),
        reset: false,
      };
    },
    "sessions.create": (params) => ({
      key: params?.sessionKey ?? "session:mock:1",
      sessionKey: params?.sessionKey ?? "session:mock:1",
      sessionId: params?.sessionKey ?? "session:mock:1",
      message: params?.message ?? "",
      runStarted: true,
      runId: "run:mock:1",
      status: "started",
    }),
    "sessions.send": (params) => ({
      sessionKey: params?.sessionKey ?? "session:mock:1",
      runId: "run:mock:2",
      status: "started",
      blocks: [
        {
          type: "text",
          text: `mock reply: ${params?.message ?? ""}`,
        },
      ],
    }),
    "sessions.list": () => ({
      count: 1,
      defaults: { contextTokens: 4096, model: "gpt-5.4", modelProvider: "openai" },
      path: "/tmp/mock-sessions.json",
      sessions: [
        {
          key: "session:mock:1",
          kind: "direct",
          label: "Mock session",
          lastMessagePreview: "hello",
          status: "idle",
          updatedAt: Date.now(),
        },
      ],
      ts: Date.now(),
    }),
    "sessions.preview": (params) => ({
      previews: (params?.keys ?? ["session:mock:1"]).map((key) => ({
        key,
        status: "ok",
        items: [
          { role: "user", text: "mock preview" },
          { role: "assistant", text: "ready" },
        ],
      })),
      ts: Date.now(),
    }),
    "agents.list": () => ({
      agents: [
        {
          id: "main",
          name: "Main",
          identity: { emoji: "M", name: "Main" },
          workspace: "/tmp/openclaw-main",
          model: { primary: "gpt-5.4", fallbacks: ["sonnet-4.6"] },
          status: "idle",
          sessionCount: 18,
          bindingCount: 4,
          lastActiveAtMs: Date.now() - 60_000,
        },
        {
          id: "ops",
          name: "Ops Runner",
          identity: { emoji: "O", name: "Ops Runner" },
          workspace: "/tmp/openclaw-ops",
          model: { primary: "gpt-5.4-mini" },
          status: "busy",
          sessionCount: 7,
          bindingCount: 2,
          lastActiveAtMs: Date.now() - 5_000,
        },
        {
          id: "research",
          name: "Research",
          identity: { emoji: "R", name: "Research" },
          workspace: "/tmp/openclaw-research",
          model: { primary: "gpt-5.4" },
          status: "offline",
          bindingCount: 1,
        },
        {
          id: "builder",
          name: "Builder Agent",
          identity: { emoji: "B", name: "Builder Agent" },
          workspace: "/tmp/openclaw-builder",
          model: { primary: "gpt-5.4" },
          status: "busy",
          sessionCount: 5,
          bindingCount: 1,
          lastActiveAtMs: Date.now() - 20_000,
        },
        {
          id: "reviewer",
          name: "Reviewer Agent",
          identity: { emoji: "R", name: "Reviewer Agent" },
          workspace: "/tmp/openclaw-reviewer",
          model: { primary: "gpt-5.4-mini" },
          status: "idle",
          sessionCount: 3,
          bindingCount: 1,
          lastActiveAtMs: Date.now() - 120_000,
        },
        {
          id: "qa",
          name: "QA Agent",
          identity: { emoji: "Q", name: "QA Agent" },
          workspace: "/tmp/openclaw-qa",
          model: { primary: "gpt-5.4-mini" },
          status: "idle",
          sessionCount: 2,
          bindingCount: 0,
        },
      ],
      defaultId: "main",
      mainKey: "main",
      scope: "local",
    }),
    "config.get": () => ({
      hash: "routing-hash-1",
      config: {
        session: { dmScope: "per-channel-peer" },
        agents: {
          defaults: {
            subagents: {
              archiveAfterMinutes: 45,
              maxChildrenPerAgent: 8,
              maxConcurrent: 4,
              maxSpawnDepth: 2,
              model: "openai/gpt-5.4",
              requireAgentId: true,
              runTimeoutSeconds: 120,
              thinking: "medium",
            },
          },
        },
        bindings: [
          {
            agentId: "ops",
            comment: "Direct finance escalation",
            match: {
              channel: "discord",
              accountId: "enterprise",
              peer: { kind: "direct", id: "finance-lead" },
            },
          },
          {
            agentId: "security",
            comment: "Guild admins and ops",
            match: {
              channel: "discord",
              guildId: "openclaw-prod",
              roles: ["admin", "ops"],
            },
          },
          {
            agentId: "main",
            comment: "Discord enterprise fallback",
            match: {
              channel: "discord",
              accountId: "enterprise",
            },
          },
        ],
      },
    }),
    "deck.routing.list": () => ({
      bindings: [
        {
          id: "route-finance-direct",
          agentId: "ops",
          tier: "peer",
          comment: "Direct finance escalation",
          match: {
            channel: "discord",
            accountId: "enterprise",
            peer: { kind: "direct", id: "finance-lead" },
          },
        },
        {
          id: "route-prod-admins",
          agentId: "security",
          tier: "guild+roles",
          comment: "Guild admins and ops",
          match: {
            channel: "discord",
            guildId: "openclaw-prod",
            roles: ["admin", "ops"],
          },
        },
        {
          id: "route-enterprise-fallback",
          agentId: "main",
          tier: "channel",
          comment: "Discord enterprise fallback",
          match: {
            channel: "discord",
            accountId: "enterprise",
          },
        },
      ],
      defaultAgentId: "main",
      dmScope: "per-channel-peer",
      configHash: "routing-hash-1",
    }),
    "deck.agents.subagents.get": (params) => ({
      agentId: params?.agentId ?? "main",
      allowAgents:
        params?.agentId === "main"
          ? ["builder", "reviewer", "qa"]
          : params?.agentId === "builder"
            ? ["reviewer", "qa"]
            : [],
      allowAny: params?.agentId === "ops",
      configHash: `${params?.agentId ?? "main"}-subagents-hash`,
      effectiveMaxChildrenPerAgent: params?.agentId === "main" ? 8 : 5,
      effectiveMaxSpawnDepth: params?.agentId === "main" ? 2 : 1,
      model: params?.agentId === "reviewer" ? "openai/gpt-5.4-mini" : undefined,
    }),
    "deck.subagents.list": (params) => {
      let runs = subagentRuns;
      if (params?.status && params.status !== "all") {
        runs = runs.filter((run) => run.status === params.status);
      }
      if (params?.agentId) {
        runs = runs.filter((run) => run.childAgentId === params.agentId);
      }
      if (params?.requesterAgentId) {
        runs = runs.filter((run) => run.requesterAgentId === params.requesterAgentId);
      }
      const offset = Number.isFinite(params?.offset) ? Math.max(0, Number(params.offset)) : 0;
      const limit = Number.isFinite(params?.limit)
        ? Math.max(0, Number(params.limit))
        : runs.length;
      const total = runs.length;
      return {
        runs: runs.slice(offset, offset + limit),
        total,
      };
    },
    "deck.subagents.lineage": (params) => {
      const rootRunId = params?.runId ?? "run-root";
      return {
        root: {
          sessionKey: "agent:main:web-main",
          agentId: "main",
          agentName: "Main",
        },
        nodes: [
          {
            runId: rootRunId,
            sessionKey: "agent:builder:web-root",
            agentId: "builder",
            agentName: "Builder Agent",
            task: "Implement the contract chain smoke test and report drift.",
            depth: 1,
            parentRunId: "",
            status: "active",
            durationMs: 250_000,
          },
          {
            runId: "run-review",
            sessionKey: "agent:reviewer:web-review",
            agentId: "reviewer",
            agentName: "Reviewer Agent",
            task: "Review gateway adapter notes for unsupported schema gaps.",
            depth: 2,
            parentRunId: rootRunId,
            status: "completed",
            durationMs: 120_000,
          },
          {
            runId: "run-qa",
            sessionKey: "agent:qa:web-visual",
            agentId: "qa",
            agentName: "QA Agent",
            task: "Run focused Playwright mock visual verification.",
            depth: 2,
            parentRunId: rootRunId,
            status: "completed",
            durationMs: 124_000,
          },
        ],
      };
    },
    "deck.subagents.kill": (params) => ({
      ok: true,
      runId: params?.runId ?? "run-root",
      childSessionKey: "agent:builder:web-root",
    }),
    "deck.subagents.steer": (params) => ({
      success: true,
      dedupKey: `mock-steer-${params?.runId ?? "run-root"}`,
      newRunId: "run-steer-followup",
    }),
    "deck.routing.validate": () => ({
      ok: true,
      tier: "peer",
      conflicts: [],
    }),
    "deck.routing.add": (params) => ({
      ok: true,
      binding: {
        id: "route-new-binding",
        agentId: params?.agentId ?? "support",
        tier: "peer",
        comment: params?.comment ?? "Mock added binding",
        match: params?.match ?? {
          channel: "wecom",
          accountId: "default",
          peer: { kind: "group", id: "support-group" },
        },
      },
      configHash: "routing-hash-2",
      warnings: [],
    }),
    "deck.routing.remove": (params) => ({
      ok: true,
      removed: {
        id: params?.id ?? "route-finance-direct",
        agentId: "ops",
        tier: "peer",
        match: {
          channel: "discord",
          accountId: "enterprise",
          peer: { kind: "direct", id: "finance-lead" },
        },
      },
      configHash: "routing-hash-2",
      impact: "Messages may fall through to the next matching binding.",
    }),
    "deck.routing.simulate": () => ({
      agentId: "ops",
      matchedBy: "peer",
      sessionKey: "agent:ops:discord:finance-lead",
      tiers: [
        { tier: "peer", matched: true, checked: true },
        { tier: "guild+roles", matched: false, checked: true },
        { tier: "channel", matched: false, checked: false },
      ],
    }),
    "deck.commands.discover": () => ({
      commands: [
        {
          name: "/compact",
          source: "builtin",
          description: "Compact the active session",
          category: "session",
        },
      ],
      version: "mock-commands-v1",
    }),
    "deck.agents.detail": () => ({
      id: "main",
      name: "Main",
      workspace: "/tmp/openclaw-main",
      model: "gpt-5.4",
      isDefault: true,
      bindingCount: 1,
      sessionCount: 1,
      activeSubagentCount: 0,
      skillMode: "enabled",
      effectiveSkills: [],
      totalAvailableSkills: 0,
      subagents: {},
      identityExists: true,
      fallbackModels: ["sonnet-4.6"],
    }),
    "usage.cost": () => ({
      updatedAt: Date.now(),
      days: 7,
      daily: [
        {
          date: "2026-05-01",
          input: 10,
          inputCost: 0.1,
          output: 5,
          outputCost: 0.2,
          cacheRead: 2,
          cacheReadCost: 0.01,
          cacheWrite: 1,
          cacheWriteCost: 0.02,
          totalTokens: 18,
          totalCost: 0.33,
          missingCostEntries: 0,
        },
      ],
      totals: {
        input: 10,
        inputCost: 0.1,
        output: 5,
        outputCost: 0.2,
        cacheRead: 2,
        cacheReadCost: 0.01,
        cacheWrite: 1,
        cacheWriteCost: 0.02,
        totalTokens: 18,
        totalCost: 0.33,
        missingCostEntries: 0,
      },
    }),
    "usage.status": () => ({
      updatedAt: Date.now(),
      providers: [
        {
          provider: "openai",
          displayName: "OpenAI",
          plan: "team",
          windows: [{ label: "daily", usedPercent: 12 }],
        },
      ],
    }),
    "sessions.usage": () => ({
      updatedAt: Date.now(),
      startDate: "2026-05-01",
      endDate: "2026-05-01",
      totals: {
        input: 10,
        output: 5,
        cacheRead: 2,
        cacheWrite: 1,
        totalTokens: 18,
        totalCost: 0.33,
      },
      aggregates: { byAgent: [{ agentId: "main", totals: { totalTokens: 18, totalCost: 0.33 } }] },
      sessions: [
        {
          key: "session:mock:1",
          label: "Mock session",
          sessionId: "session:mock:1",
          updatedAt: Date.now(),
          agentId: "main",
          channel: "web",
          usage: { totalTokens: 18, totalCost: 0.33 },
        },
      ],
    }),
    "sessions.usage.logs": () => ({
      logs: [
        {
          timestamp: Date.now(),
          role: "assistant",
          content: "mock usage log",
          tokens: 18,
          cost: 0.33,
        },
      ],
    }),
    "sessions.usage.timeseries": () => ({
      sessionId: "session:mock:1",
      points: [
        {
          timestamp: Date.now(),
          input: 10,
          output: 5,
          cacheRead: 2,
          cacheWrite: 1,
          totalTokens: 18,
          cost: 0.33,
          cumulativeTokens: 18,
          cumulativeCost: 0.33,
        },
      ],
    }),
    "exec.approvals.get": () => ({
      exists: true,
      hash: "hash-1",
      path: "/tmp/mock-approvals.json",
      file: {
        version: 1,
        defaults: { security: "on-request", ask: "auto", autoAllowSkills: true },
        agents: {},
      },
    }),
    "exec.approval.list": () => [
      {
        id: "approval-1",
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
        request: {
          command: "npm test",
          commandArgv: ["npm", "test"],
          agentId: "main",
          sessionKey: "session:mock:1",
          runId: "run:mock:1",
          cwd: "/tmp/openclaw-main",
        },
      },
    ],
  };
}

export async function startMockGateway(options = {}) {
  const token = options.token ?? defaultToken;
  const methods = { ...defaultMethods(), ...options.methods };
  const requestLog = options.requestLog ?? process.env.MOCK_GATEWAY_REQUEST_LOG ?? "";
  const requests = [];
  const recordRequest = (entry) => {
    requests.push(entry);
    if (requestLog) {
      fs.appendFileSync(requestLog, JSON.stringify(entry) + "\n");
    }
  };
  const server = http.createServer((_, res) => {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ code: "not_found", message: "mock gateway only serves WebSocket RPC" }),
    );
  });
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "mock-nonce" },
      }),
    );

    socket.on("message", (raw) => {
      let frame;
      try {
        const text =
          typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString("utf-8") : "";
        frame = JSON.parse(text);
      } catch {
        socket.send(JSON.stringify(responseError("", "invalid_json", "invalid JSON frame")));
        return;
      }
      if (frame.type !== "req") {
        return;
      }
      recordRequest({ method: frame.method, params: frame.params });
      if (frame.method === "connect") {
        const suppliedToken = frame.params?.auth?.token;
        if (suppliedToken !== token) {
          socket.send(JSON.stringify(responseError(frame.id, "unauthorized", "invalid token")));
          return;
        }
        socket.send(JSON.stringify(response(frame.id, { ok: true, protocol: protocolVersion })));
        return;
      }
      const handler = methods[frame.method];
      if (!handler) {
        socket.send(
          JSON.stringify(
            responseError(frame.id, "method_not_found", `unknown method: ${frame.method}`),
          ),
        );
        return;
      }
      try {
        socket.send(JSON.stringify(response(frame.id, handler(frame.params ?? {}))));
      } catch (error) {
        socket.send(
          JSON.stringify(
            responseError(
              frame.id,
              "mock_handler_failed",
              error instanceof Error ? error.message : String(error),
            ),
          ),
        );
      }
    });
  });

  await new Promise((resolve) =>
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", resolve),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock gateway failed to bind a TCP address");
  }
  const url = `http://${address.address}:${address.port}`;
  return {
    url,
    wsUrl: `ws://${address.address}:${address.port}`,
    token,
    requests,
    close: async () => {
      for (const client of wss.clients) {
        client.terminate();
      }
      await new Promise((resolve, reject) => {
        wss.close((wssError) => {
          if (wssError) {
            reject(wssError);
            return;
          }
          server.close((serverError) => {
            if (serverError) {
              reject(serverError);
              return;
            }
            resolve();
          });
        });
      });
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const gateway = await startMockGateway({
    token: process.env.MOCK_GATEWAY_TOKEN ?? defaultToken,
    port: process.env.MOCK_GATEWAY_PORT ? Number(process.env.MOCK_GATEWAY_PORT) : 0,
    requestLog: process.env.MOCK_GATEWAY_REQUEST_LOG,
  });
  process.stdout.write(JSON.stringify({ url: gateway.url, token: gateway.token }) + "\n");
  const shutdown = async () => {
    await gateway.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
