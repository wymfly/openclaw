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

function visualMonitorEvents(now = Date.now()) {
  const sessionKey = "agent:main:visual";
  const runId = "run-visual-1";
  return [
    {
      event: "activity.event",
      payload: {
        id: "activity-visual-1",
        timestamp: now - 7_000,
        type: "chat",
        agentId: "main",
        agentName: "Main Agent",
        description: "Chat run completed",
        details: `${runId} · ${sessionKey}`,
      },
    },
    {
      event: "chat",
      payload: {
        runId,
        seq: 1,
        sessionKey,
        state: "final",
        message: {
          id: "msg-visual-final",
          role: "assistant",
          content: [{ type: "text", text: "Mock visual monitor run completed." }],
          timestamp: now - 6_000,
        },
        usage: {
          input_tokens: 720,
          output_tokens: 480,
        },
      },
    },
    {
      event: "agent",
      payload: {
        runId,
        seq: 2,
        sessionKey,
        stream: "tool",
        data: {
          name: "write",
          phase: "result",
          result: "frontend gateway visual fixture updated",
        },
      },
    },
    {
      event: "agent",
      payload: {
        runId,
        seq: 3,
        sessionKey,
        stream: "lifecycle",
        data: {
          childRunId: "run-visual-review",
          childSessionKey: "agent:reviewer:visual",
        },
      },
    },
  ];
}

function sendVisualMonitorEvents(socket) {
  for (const item of visualMonitorEvents()) {
    socket.send(JSON.stringify({ type: "event", event: item.event, payload: item.payload }));
  }
}

function memoryWorkspaceFor(agentId) {
  return `/tmp/openclaw-${agentId}`;
}

function ensureMockMemoryWorkspaces(now = Date.now()) {
  const workspaces = {
    builder: memoryWorkspaceFor("builder"),
    main: memoryWorkspaceFor("main"),
    ops: memoryWorkspaceFor("ops"),
    qa: memoryWorkspaceFor("qa"),
    research: memoryWorkspaceFor("research"),
    reviewer: memoryWorkspaceFor("reviewer"),
  };
  const filesByAgent = {
    builder: {
      "daily.md": "# Builder memory\n\n- Keep visual verification repeatable.",
      "archive/note.md": "Builder archive note for memory browse visual state.",
    },
    main: {
      "daily.md":
        "# remembered context\n\n- Keep frontend work contract-led.\n- Preserve confirmation guards for dream actions.",
      "archive/note.md": "Archived memory note for the main agent.",
      "graph/context.md": "Path relationship context for memory graph rows.",
    },
    ops: {
      "daily.md": "Ops runner remembered incident triage context.",
    },
    qa: {
      "daily.md": "QA remembered smoke-test evidence.",
    },
    research: {
      "daily.md": "Research remembered source review notes.",
    },
    reviewer: {
      "daily.md": "Reviewer remembered critique checklist.",
    },
  };
  for (const [agentId, workspace] of Object.entries(workspaces)) {
    fs.mkdirSync(workspace, { recursive: true });
    for (const [relativePath, content] of Object.entries(filesByAgent[agentId] ?? {})) {
      const target = `${workspace}/${relativePath}`;
      const dir = target.slice(0, target.lastIndexOf("/"));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, content);
    }
    fs.utimesSync(workspace, new Date(now - 90_000), new Date(now - 60_000));
  }
  return workspaces;
}

function listMemoryWorkspaceFiles(workspace) {
  const entries = [];
  const walk = (dir, prefix = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolutePath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      const stat = fs.statSync(absolutePath);
      entries.push({
        content: fs.readFileSync(absolutePath, "utf8"),
        missing: false,
        name: entry.name,
        path: relativePath,
        size: stat.size,
        updatedAtMs: Math.trunc(stat.mtimeMs),
      });
    }
  };
  if (fs.existsSync(workspace)) {
    walk(workspace);
  }
  return entries;
}

function readMemoryWorkspaceFile(workspace, name) {
  const files = listMemoryWorkspaceFiles(workspace);
  const file = files.find((entry) => entry.name === name || entry.path === name);
  return (
    file ?? {
      missing: true,
      name,
      path: name,
    }
  );
}

function defaultMethods() {
  const now = Date.now();
  const memoryWorkspaces = ensureMockMemoryWorkspaces(now);
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
  const threadBindings = [
    {
      threadId: "thread-main",
      channelId: "discord",
      agentId: "main",
      targetSessionKey: "agent:main:web-main",
      targetKind: "session",
      boundAt: now - 62_000,
      lastActivityAt: now - 10_000,
      accountId: "acct-main",
      boundBy: "operator",
      label: "Main support thread",
    },
    {
      threadId: "thread-builder",
      channelId: "discord",
      agentId: "builder",
      targetSessionKey: "agent:builder:web-root",
      targetKind: "session",
      boundAt: now - 180_000,
      lastActivityAt: now - 42_000,
      accountId: "acct-builder",
      boundBy: "routing",
      label: "Builder escalation",
    },
    {
      threadId: "thread-long-enterprise-direct-openclaw-prod-incident-room",
      channelId: "discord",
      agentId: "security",
      targetSessionKey: "agent:security:web-risk",
      targetKind: "session",
      boundAt: now - 900_000,
      lastActivityAt: now - 180_000,
      accountId: "enterprise",
      boundBy: "system",
    },
    {
      threadId: "thread-wecom-ops",
      channelId: "wecom",
      agentId: "ops",
      targetSessionKey: "agent:ops:web-incident",
      targetKind: "session",
      boundAt: now - 1_200_000,
      lastActivityAt: now - 360_000,
      accountId: "default",
      boundBy: "mock",
      label: "WeCom operations thread",
    },
  ];
  const sessionFixtures = [
    {
      key: "session:mock:1",
      kind: "direct",
      agentId: "main",
      label: "Main Label",
      title: "Main Session",
      updatedAt: now - 18_000,
      lastMessagePreview: "hello from main",
      status: "idle",
      runtimeMs: 123,
      model: "gpt-5.4",
      modelProvider: "openai",
      thinkingLevel: "low",
      fastMode: true,
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      totalTokensFresh: true,
      contextTokens: 1000,
      estimatedCostUsd: 0.25,
      compactionCount: 2,
    },
    {
      key: "agent:builder:web-root",
      kind: "subagent",
      agentId: "builder",
      title: "Builder Session",
      updatedAt: now - 36_000,
      lastMessagePreview: "build preview",
      status: "running",
      runtimeMs: 456,
      model: "sonnet-4.6",
      modelProvider: "anthropic",
      parentSessionKey: "session:mock:1",
      childSessions: ["agent:reviewer:web-review"],
      subagentRole: "leaf",
      subagentControlScope: "children",
      spawnedWorkspaceDir: "/tmp/openclaw-subagent",
    },
  ];
  const sessionMessages = {
    "session:mock:1": [
      {
        id: "history-session-mock-1",
        role: "user",
        content: [{ type: "text", text: "history session:mock:1" }],
      },
      {
        id: "assistant-session-mock-1",
        role: "assistant",
        content: [{ type: "text", text: "Main session is ready for export and compaction." }],
      },
    ],
    "agent:builder:web-root": [
      {
        id: "history-builder-root",
        role: "user",
        content: [{ type: "text", text: "history agent:builder:web-root" }],
      },
      {
        id: "assistant-builder-root",
        role: "assistant",
        content: [{ type: "text", text: "Builder session is running a visual fixture task." }],
      },
    ],
  };
  const sessionByKey = new Map(sessionFixtures.map((session) => [session.key, session]));
  const sessionFor = (key) =>
    sessionByKey.get(key) ?? {
      key,
      kind: "direct",
      agentId: "main",
      label: key,
      title: key,
      updatedAt: now,
      status: "idle",
    };
  const sessionKeyFrom = (params) => params?.key ?? params?.sessionKey ?? "session:mock:1";
  const channelStatus = {
    channelOrder: ["discord", "wecom", "telegram"],
    channels: {
      discord: {
        enabled: true,
        connected: true,
        status: "ready",
        latencyMs: 84,
      },
      wecom: {
        enabled: true,
        connected: true,
        status: "ready",
        latencyMs: 128,
      },
      telegram: {
        enabled: false,
        connected: false,
        status: "disabled",
        latencyMs: 0,
      },
    },
    channelAccounts: {
      discord: [
        {
          accountId: "enterprise",
          name: "Enterprise Discord",
          enabled: true,
          configured: true,
          linked: true,
          connected: true,
          healthState: "healthy",
          activeRuns: 2,
          dmPolicy: "per-channel-peer",
          lastInboundAt: now - 32_000,
          lastOutboundAt: now - 18_000,
          probe: { ok: true, latencyMs: 84 },
        },
        {
          accountId: "community",
          name: "Community Guild",
          enabled: true,
          configured: true,
          linked: true,
          connected: false,
          healthState: "degraded",
          lastError: "gateway reconnect backoff is active",
          reconnectAttempts: 2,
          probe: { ok: false, error: "gateway reconnect backoff is active" },
        },
      ],
      wecom: [
        {
          accountId: "default",
          name: "WeCom Ops",
          enabled: true,
          configured: true,
          linked: true,
          connected: true,
          allowFrom: ["finance-lead", "ops-admin"],
          allowUnmentionedGroups: false,
          healthState: "healthy",
          probe: { ok: true, latencyMs: 128 },
        },
        {
          accountId: "tenant-b",
          name: "WeCom Tenant B",
          enabled: true,
          configured: true,
          linked: false,
          connected: false,
          allowFrom: [],
          healthState: "attention",
          lastError: "tenant-b pairing is pending",
          probe: { ok: false, error: "tenant-b pairing is pending" },
        },
      ],
      telegram: [
        {
          accountId: "alerts",
          name: "Telegram Alerts",
          enabled: false,
          configured: false,
          linked: false,
          connected: false,
          healthState: "disabled",
          probe: { ok: false, error: "channel disabled" },
        },
      ],
    },
    channelDefaultAccountId: {
      discord: "enterprise",
      wecom: "default",
      telegram: "alerts",
    },
    channelLabels: {
      discord: "Discord",
      wecom: "WeCom",
      telegram: "Telegram",
    },
    channelDetailLabels: {
      discord: "Discord workspace bridge",
      wecom: "WeCom operations bridge",
      telegram: "Telegram alert bridge",
    },
    channelSystemImages: {
      discord: "discord",
      wecom: "wecom",
      telegram: "telegram",
    },
    channelMeta: [
      {
        id: "discord",
        label: "Discord",
        detailLabel: "Discord workspace bridge",
        systemImage: "discord",
        pluginId: "discord",
        pluginOrigin: "bundled",
        pluginConfigPath: "channels.discord",
      },
      {
        id: "wecom",
        label: "WeCom",
        detailLabel: "WeCom operations bridge",
        systemImage: "wecom",
        pluginId: "wecom",
        pluginOrigin: "bundled",
        pluginConfigPath: "channels.wecom",
      },
      {
        id: "telegram",
        label: "Telegram",
        detailLabel: "Telegram alert bridge",
        systemImage: "telegram",
        pluginId: "telegram",
        pluginOrigin: "bundled",
        pluginConfigPath: "channels.telegram",
      },
    ],
    ts: now,
  };
  const configFixture = {
    session: { dmScope: "per-channel-peer" },
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-5.4",
          fallbacks: ["anthropic/sonnet-4.6"],
          sendPolicy: "session",
        },
        imageModel: {
          primary: "openai/gpt-4o",
          fallbacks: [],
        },
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
    models: {
      mode: "merge",
      providers: {
        openai: {
          api: "openai-responses",
          auth: "api-key",
          baseUrl: "https://api.openai.com/v1",
          apiKeyEnv: "OPENAI_API_KEY",
          models: [
            { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 200000, maxTokens: 8192 },
            { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxTokens: 4096 },
          ],
        },
        anthropic: {
          api: "anthropic-messages",
          auth: "api-key",
          apiKeyEnv: "ANTHROPIC_API_KEY",
          models: ["claude-4.6"],
        },
      },
      bedrockDiscovery: {
        enabled: true,
        region: "us-east-1",
        providerFilter: ["anthropic", "amazon"],
        refreshInterval: 3600,
        defaultContextWindow: 200000,
        defaultMaxTokens: 4096,
      },
    },
    channels: {
      wecom: {
        accounts: {
          default: {
            bot: { dm: { policy: "allowlist", allowFrom: ["finance-lead", "ops-admin"] } },
            agent: { dm: { policy: "open", allowFrom: ["ops-admin"] } },
          },
          "tenant-b": {
            bot: { dm: { policy: "pairing", allowFrom: [] } },
            agent: { dm: { policy: "allowlist", allowFrom: [] } },
          },
        },
        dynamicAgents: {
          enabled: true,
          dmCreateAgent: true,
          groupEnabled: false,
          adminUsers: ["ops-admin"],
        },
        routing: { failClosedOnDefaultRoute: false },
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
      {
        agentId: "ops",
        comment: "WeCom default operations",
        match: {
          channel: "wecom",
          accountId: "default",
        },
      },
    ],
  };
  return {
    "gateway.describe": () => ({
      version: "mock-gateway",
      gatewayVersion: "mock-gateway",
      protocol: protocolVersion,
    }),
    health: () => ({
      ok: true,
      durationMs: 17,
      agents: [{ id: "main", sessions: { count: 2 } }],
      sessions: { count: 2, path: "/tmp/mock-sessions.json", recent: [] },
      channels: { discord: "connected", wecom: "connected" },
    }),
    status: () => ({
      channelSummary: ["discord connected", "wecom connected"],
      heartbeat: {
        agents: [{ agentId: "main", enabled: true, every: "30m" }],
        defaultAgentId: "main",
      },
      queuedSystemEvents: [],
      runtimeVersion: "mock-gateway",
      sessions: {
        byAgent: [{ agentId: "main", count: 3 }],
        count: 3,
        defaults: { contextTokens: 4096, model: "gpt-5.4" },
        paths: ["/tmp/mock-sessions.json"],
        recent: [],
      },
    }),
    "models.configured": () => ({
      models: [
        {
          id: "gpt-5.4",
          name: "GPT-5.4",
          provider: "openai",
          modelIdentifier: "openai/gpt-5.4",
          contextWindow: 200000,
          cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
          input: ["text"],
          maxTokens: 8192,
          reasoning: true,
          authStatus: "ready",
          source: "config",
          scope: "global",
          editable: true,
        },
        {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
          modelIdentifier: "openai/gpt-4o",
          contextWindow: 128000,
          input: ["text", "image"],
          maxTokens: 4096,
          authStatus: "ready",
          source: "config",
          scope: "global",
          editable: true,
        },
        {
          id: "sonnet-4.6",
          name: "Claude Sonnet 4.6",
          provider: "anthropic",
          modelIdentifier: "anthropic/sonnet-4.6",
          contextWindow: 200000,
          input: ["text"],
          maxTokens: 8192,
          authStatus: "warning",
          source: "config",
          scope: "global",
          editable: true,
        },
      ],
    }),
    "deck.auth.overview": () => ({
      providers: [
        {
          provider: "openai",
          status: "ready",
          source: "config",
          scope: "global",
          configPresent: true,
          authPresent: true,
          editable: true,
          auth: { type: "api_key", source: "env" },
          oauth: { status: "ok", remainingMs: 90_000_000, expiresAt: Date.now() + 90_000_000 },
          usage: {
            plan: "team",
            windows: [
              { label: "daily", usedPercent: 40, resetsInMs: 18_000_000 },
              { label: "hourly", usedPercent: 90, resetsInMs: 1_800_000 },
            ],
          },
        },
        {
          provider: "anthropic",
          status: "warning",
          source: "config",
          scope: "global",
          configPresent: true,
          authPresent: false,
          editable: true,
          auth: { type: "api_key", source: "env" },
          cooldown: {
            reason: "rate_limited",
            remainingMs: 5_400_000,
            until: Date.now() + 5_400_000,
          },
        },
      ],
    }),
    "models.catalog.providers": () => ({
      providers: [
        {
          id: "openai",
          displayName: "OpenAI Catalog",
          api: "openai-responses",
          authType: "api-key",
          modelCount: 2,
          defaultBaseUrl: "https://api.openai.com/v1",
          models: [
            {
              id: "gpt-5.4",
              name: "GPT-5.4",
              contextWindow: 200000,
              maxTokens: 8192,
              reasoning: true,
            },
            {
              id: "gpt-5.4-mini",
              name: "GPT-5.4 Mini",
              contextWindow: 128000,
              maxTokens: 4096,
              reasoning: false,
            },
          ],
        },
        {
          id: "anthropic",
          displayName: "Claude Catalog",
          api: "anthropic-messages",
          authType: "api-key",
          modelCount: 2,
          models: [
            {
              id: "claude-4.6",
              name: "Claude 4.6",
              contextWindow: 200000,
              maxTokens: 8192,
              reasoning: true,
            },
            {
              id: "sonnet-4.6",
              name: "Claude Sonnet 4.6",
              contextWindow: 200000,
              maxTokens: 8192,
              reasoning: true,
            },
          ],
        },
      ],
    }),
    "deck.auth.probe": (params) => ({
      provider: params?.provider ?? "openai",
      model: params?.model ?? "gpt-5.4",
      label: "Mock model probe",
      source: "mock-gateway",
      mode: "api_key",
      status: "ready",
      latencyMs: 42,
    }),
    "sessions.subscribe": () => ({ ok: true }),
    "sessions.unsubscribe": () => ({ ok: true }),
    "sessions.messages.subscribe": (params) => ({
      ok: true,
      key: params?.key ?? params?.sessionKey ?? "agent:main:visual",
    }),
    "sessions.messages.unsubscribe": (params) => ({
      ok: true,
      key: params?.key ?? params?.sessionKey ?? "agent:main:visual",
    }),
    "channels.status": () => channelStatus,
    "channels.logout": (params) => ({
      accountId: params?.accountId ?? "",
      channel: params?.channel ?? "discord",
      cleared: true,
    }),
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
    "chat.history": (params) => {
      const key = sessionKeyFrom(params);
      return {
        messages: sessionMessages[key] ?? [
          {
            id: `history-${key}`,
            role: "user",
            content: [{ type: "text", text: `history ${key}` }],
          },
        ],
      };
    },
    "sessions.list": () => ({
      count: sessionFixtures.length,
      defaults: { contextTokens: 4096, model: "gpt-5.4", modelProvider: "openai" },
      path: "/tmp/mock-sessions.json",
      sessions: sessionFixtures,
      ts: Date.now(),
    }),
    "sessions.get": (params) => {
      const key = sessionKeyFrom(params);
      return {
        session: sessionFor(key),
        messages: sessionMessages[key] ?? [],
      };
    },
    "sessions.preview": (params) => ({
      previews: (params?.keys ?? ["session:mock:1"]).map((key) => ({
        key,
        status: "ok",
        items: [
          { role: "user", text: sessionFor(key).lastMessagePreview ?? "mock preview" },
          { role: "assistant", text: "ready" },
        ],
      })),
      ts: Date.now(),
    }),
    "sessions.reset": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
      reason: params?.reason ?? "reset",
    }),
    "sessions.clear": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
    }),
    "sessions.patch": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
      entry: {
        label: params?.label,
        model: params?.model,
        thinkingLevel: params?.thinkingLevel,
        fastMode: params?.fastMode,
      },
    }),
    "sessions.delete": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
      action: "delete",
    }),
    "sessions.compact": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
      status: 202,
    }),
    "sessions.compaction.list": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
      checkpoints: [
        {
          checkpointId: "cp-1",
          sessionKey: sessionKeyFrom(params),
          sessionId: sessionKeyFrom(params),
          createdAt: now - 24_000,
          reason: "manual",
          tokensBefore: 5000,
          tokensAfter: 2000,
          summary: "compressed older turns",
        },
      ],
    }),
    "sessions.compaction.branch": (params) => ({
      ok: true,
      key: `${sessionKeyFrom(params)}:branch`,
      checkpointId: params?.checkpointId ?? "cp-1",
    }),
    "sessions.compaction.restore": (params) => ({
      ok: true,
      key: sessionKeyFrom(params),
      checkpointId: params?.checkpointId ?? "cp-1",
    }),
    "agents.files.list": (params) => {
      const agentId = params?.agentId ?? "main";
      const workspace = memoryWorkspaces[agentId] ?? memoryWorkspaces.main;
      return {
        agentId,
        files: listMemoryWorkspaceFiles(workspace),
        workspace,
      };
    },
    "agents.files.get": (params) => {
      const agentId = params?.agentId ?? "main";
      const workspace = memoryWorkspaces[agentId] ?? memoryWorkspaces.main;
      return {
        agentId,
        file: readMemoryWorkspaceFile(workspace, params?.name ?? "daily.md"),
        workspace,
      };
    },
    "agents.files.set": (params) => {
      const agentId = params?.agentId ?? "main";
      const workspace = memoryWorkspaces[agentId] ?? memoryWorkspaces.main;
      const name = params?.name ?? "note.md";
      const target = `${workspace}/${name}`;
      const dir = target.slice(0, target.lastIndexOf("/"));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(target, params?.content ?? "");
      return {
        agentId,
        file: readMemoryWorkspaceFile(workspace, name),
        workspace,
      };
    },
    "agents.list": () => ({
      agents: [
        {
          id: "main",
          name: "Main",
          identity: { emoji: "M", name: "Main" },
          workspace: memoryWorkspaces.main,
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
          workspace: memoryWorkspaces.ops,
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
          workspace: memoryWorkspaces.research,
          model: { primary: "gpt-5.4" },
          status: "offline",
          bindingCount: 1,
        },
        {
          id: "builder",
          name: "Builder Agent",
          identity: { emoji: "B", name: "Builder Agent" },
          workspace: memoryWorkspaces.builder,
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
          workspace: memoryWorkspaces.reviewer,
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
          workspace: memoryWorkspaces.qa,
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
      baseHash: "routing-hash-1",
      exists: true,
      hash: "routing-hash-1",
      path: "/tmp/mock-openclaw.json",
      raw: JSON.stringify(configFixture, null, 2),
      valid: true,
      config: configFixture,
    }),
    "config.schema.lookup": (params) => ({
      path: params?.path ?? "models.providers",
      schema: { type: "object" },
      children: [
        {
          key: "anthropic",
          path: "models.providers.anthropic",
          required: false,
          hasChildren: true,
        },
        {
          key: "openai",
          path: "models.providers.openai",
          required: false,
          hasChildren: true,
        },
      ],
    }),
    "config.patch": (params) => ({
      ok: true,
      baseHash: params?.baseHash ?? "routing-hash-1",
      hash: "routing-hash-2",
      raw: params?.raw ?? "{}",
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
        {
          id: "route-wecom-default",
          agentId: "ops",
          tier: "account",
          comment: "WeCom default operations",
          match: {
            channel: "wecom",
            accountId: "default",
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
    "deck.threads.list": (params) => {
      let threads = threadBindings;
      const agentId = typeof params?.agentId === "string" ? params.agentId.trim() : "";
      const channel = typeof params?.channel === "string" ? params.channel.trim() : "";
      const status = typeof params?.status === "string" ? params.status.trim() : "";
      if (agentId) {
        threads = threads.filter((thread) => thread.agentId === agentId);
      }
      if (channel) {
        threads = threads.filter((thread) => thread.channelId === channel);
      }
      if (status && status !== "active" && status !== "all") {
        threads = [];
      }
      return { threads };
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
    "device.pair.list": () => ({
      pending: [
        {
          requestId: "req-visual-1",
          deviceId: "pending-mac-visual",
          displayName: "Ops laptop",
          platform: "darwin",
          deviceFamily: "desktop",
          role: "operator",
          roles: ["operator"],
          scopes: ["operator", "settings.write"],
          remoteIp: "10.20.0.42",
          ts: now - 125_000,
        },
      ],
      paired: [
        {
          deviceId: "visual-self-device",
          displayName: "Control room Mac",
          platform: "darwin",
          deviceFamily: "desktop",
          clientMode: "browser",
          role: "operator",
          roles: ["operator"],
          scopes: ["operator", "settings.read"],
          remoteIp: "127.0.0.1",
          tokens: [
            {
              role: "operator",
              scopes: ["operator", "settings.read"],
              createdAtMs: now - 720_000,
              lastUsedAtMs: now - 60_000,
            },
          ],
          createdAtMs: now - 900_000,
          approvedAtMs: now - 840_000,
        },
        {
          deviceId: "visual-ops-tablet",
          displayName: "Ops tablet",
          platform: "ios",
          deviceFamily: "mobile",
          clientMode: "browser",
          role: "viewer",
          roles: ["viewer"],
          scopes: ["settings.read"],
          remoteIp: "10.20.0.65",
          tokens: [
            {
              role: "viewer",
              scopes: ["settings.read"],
              createdAtMs: now - 540_000,
            },
          ],
          createdAtMs: now - 610_000,
          approvedAtMs: now - 600_000,
        },
      ],
    }),
    "device.pair.approve": (params) => ({
      ok: true,
      requestId: params?.requestId ?? "req-visual-1",
      approved: true,
    }),
    "device.pair.reject": (params) => ({
      ok: true,
      requestId: params?.requestId ?? "req-visual-1",
      rejected: true,
    }),
    "device.pair.remove": (params) => ({
      ok: true,
      deviceId: params?.deviceId ?? "visual-ops-tablet",
      removed: true,
    }),
    "device.token.rotate": (params) => ({
      ok: true,
      deviceId: params?.deviceId ?? "visual-ops-tablet",
      role: params?.role ?? "viewer",
      token: "visual-rotated-device-token",
    }),
    "device.token.revoke": (params) => ({
      ok: true,
      deviceId: params?.deviceId ?? "visual-ops-tablet",
      role: params?.role ?? "viewer",
      revoked: true,
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
          input: 28_000,
          inputCost: 0.42,
          output: 9_000,
          outputCost: 0.34,
          cacheRead: 6_000,
          cacheReadCost: 0.03,
          cacheWrite: 1_000,
          cacheWriteCost: 0.02,
          totalTokens: 44_000,
          totalCost: 0.81,
          missingCostEntries: 0,
        },
        {
          date: "2026-05-02",
          input: 72_000,
          inputCost: 0.8,
          output: 22_000,
          outputCost: 1.2,
          cacheRead: 18_000,
          cacheReadCost: 0.04,
          cacheWrite: 2_000,
          cacheWriteCost: 0.06,
          totalTokens: 114_000,
          totalCost: 2.1,
          missingCostEntries: 0,
        },
        {
          date: "2026-05-03",
          input: 44_000,
          inputCost: 0.55,
          output: 14_000,
          outputCost: 0.62,
          cacheRead: 9_000,
          cacheReadCost: 0.03,
          cacheWrite: 1_000,
          cacheWriteCost: 0.02,
          totalTokens: 68_000,
          totalCost: 1.22,
          missingCostEntries: 0,
        },
      ],
      totals: {
        input: 144_000,
        inputCost: 1.77,
        output: 45_000,
        outputCost: 2.16,
        cacheRead: 33_000,
        cacheReadCost: 0.1,
        cacheWrite: 4_000,
        cacheWriteCost: 0.1,
        totalTokens: 226_000,
        totalCost: 4.13,
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
          windows: [
            { label: "daily", usedPercent: 63, resetAt: now + 9 * 60 * 60 * 1_000 },
            { label: "hourly", usedPercent: 90, resetAt: now + 42 * 60 * 1_000 },
          ],
        },
        {
          provider: "anthropic",
          displayName: "Anthropic",
          plan: "pro",
          windows: [{ label: "daily", usedPercent: 50, resetAt: now + 7 * 60 * 60 * 1_000 }],
        },
        {
          provider: "local",
          displayName: "Local fallback",
          plan: "unmetered",
          windows: [{ label: "daily", usedPercent: 12 }],
        },
      ],
    }),
    "sessions.usage": (params) => {
      const key = sessionKeyFrom(params);
      const session = sessionFor(key);
      const contextWeight = {
        source: "run",
        generatedAt: Date.now(),
        sessionKey: key,
        provider: "openai",
        model: "gpt-5.4",
        workspaceDir: "/tmp/openclaw-main",
        systemPrompt: {
          chars: 6_800,
          projectContextChars: 3_400,
          nonProjectContextChars: 3_400,
        },
        tools: {
          listChars: 1_100,
          schemaChars: 2_100,
          entries: [
            { name: "search", summaryChars: 120, schemaChars: 420, propertiesCount: 4 },
            { name: "read_file", summaryChars: 80, schemaChars: 360, propertiesCount: 3 },
          ],
        },
        skills: {
          promptChars: 1_050,
          entries: [
            { name: "frontend-design", blockChars: 640 },
            { name: "openspec-apply-change", blockChars: 410 },
          ],
        },
        injectedWorkspaceFiles: [
          {
            name: "AGENTS.md",
            path: "AGENTS.md",
            missing: false,
            rawChars: 1_600,
            injectedChars: 1_200,
            truncated: false,
          },
          {
            name: "README.md",
            path: "README.md",
            missing: false,
            rawChars: 820,
            injectedChars: 600,
            truncated: false,
          },
        ],
      };
      const usageSessions = [
        {
          key: "session:mock:1",
          label: "Main production review",
          sessionId: "session:mock:1",
          updatedAt: now - 18_000,
          agentId: "main",
          channel: "web",
          usage: { input: 58_000, output: 19_000, totalTokens: 84_000, totalCost: 1.42 },
          contextWeight,
        },
        {
          key: "agent:builder:web-root",
          label: "Builder validation",
          sessionId: "agent:builder:web-root",
          updatedAt: now - 36_000,
          agentId: "builder",
          channel: "web",
          usage: { input: 42_000, output: 11_000, totalTokens: 48_000, totalCost: 0.74 },
          contextWeight,
        },
        {
          key: "agent:ops:discord-triage",
          label: "Ops channel triage",
          sessionId: "agent:ops:discord-triage",
          updatedAt: now - 78_000,
          agentId: "ops",
          channel: "discord",
          usage: { input: 28_000, output: 8_000, totalTokens: 30_000, totalCost: 0.27 },
        },
      ];
      const selectedSessions = params?.key
        ? usageSessions.filter((entry) => entry.key === key)
        : usageSessions;
      return {
        updatedAt: Date.now(),
        startDate: "2026-05-01",
        endDate: "2026-05-03",
        totals: {
          input: 128_000,
          output: 38_000,
          cacheRead: 24_000,
          cacheWrite: 3_000,
          totalTokens: 162_000,
          totalCost: 2.43,
        },
        aggregates: {
          byAgent: [
            { agentId: "main", totals: { totalTokens: 84_000, totalCost: 1.42 } },
            { agentId: "builder", totals: { totalTokens: 48_000, totalCost: 0.74 } },
            { agentId: "ops", totals: { totalTokens: 30_000, totalCost: 0.27 } },
          ],
          byChannel: [
            { channel: "web", totals: { totalTokens: 132_000, totalCost: 2.16 } },
            { channel: "discord", totals: { totalTokens: 30_000, totalCost: 0.27 } },
          ],
          byModel: [
            { model: "gpt-5.4", totals: { totalTokens: 132_000, totalCost: 2.01 } },
            { model: "sonnet-4.6", totals: { totalTokens: 30_000, totalCost: 0.42 } },
          ],
          byProvider: [
            { provider: "openai", totals: { totalTokens: 144_000, totalCost: 2.1 } },
            { provider: "anthropic", totals: { totalTokens: 18_000, totalCost: 0.33 } },
          ],
          daily: [
            {
              date: "2026-05-01",
              tokens: 44_000,
              cost: 0.81,
              messages: 11,
              toolCalls: 3,
              errors: 0,
            },
            {
              date: "2026-05-02",
              tokens: 114_000,
              cost: 2.1,
              messages: 18,
              toolCalls: 6,
              errors: 1,
            },
            {
              date: "2026-05-03",
              tokens: 68_000,
              cost: 1.22,
              messages: 8,
              toolCalls: 2,
              errors: 0,
            },
          ],
          modelDaily: [
            {
              date: "2026-05-01",
              provider: "openai",
              model: "gpt-5.4",
              tokens: 44_000,
              cost: 0.81,
              count: 2,
            },
            {
              date: "2026-05-02",
              provider: "openai",
              model: "gpt-5.4",
              tokens: 88_000,
              cost: 1.2,
              count: 3,
            },
            {
              date: "2026-05-02",
              provider: "anthropic",
              model: "sonnet-4.6",
              tokens: 26_000,
              cost: 0.9,
              count: 1,
            },
            {
              date: "2026-05-03",
              provider: "openai",
              model: "gpt-5.4-mini",
              tokens: 68_000,
              cost: 1.22,
              count: 2,
            },
          ],
          latency: { count: 18, avgMs: 820, p95Ms: 1_240, minMs: 120, maxMs: 1_900 },
          messages: { total: 37, user: 14, assistant: 16, toolCalls: 5, toolResults: 2, errors: 1 },
          tools: {
            totalCalls: 11,
            uniqueTools: 4,
            tools: [
              { name: "search", count: 6 },
              { name: "read_file", count: 3 },
              { name: "write_file", count: 1 },
              { name: "gateway.describe", count: 1 },
            ],
          },
        },
        sessions:
          selectedSessions.length > 0
            ? selectedSessions
            : [
                {
                  key,
                  label: session.title ?? session.label ?? key,
                  sessionId: key,
                  updatedAt: Date.now(),
                  agentId: session.agentId ?? "main",
                  channel: "web",
                  usage: { input: 100, output: 50, totalTokens: 150, totalCost: 1.25 },
                  contextWeight,
                },
              ],
      };
    },
    "sessions.usage.logs": () => ({
      logs: [
        {
          timestamp: Date.now() - 2_000,
          role: "user",
          content: "usage log detail",
          tokens: 12,
          cost: 0.01,
        },
        {
          timestamp: Date.now() - 1_000,
          role: "assistant",
          content: "small turn",
          tokens: 10,
          cost: 0.01,
        },
        {
          timestamp: Date.now(),
          role: "assistant",
          content: "large turn",
          tokens: 80,
          cost: 0.03,
        },
      ],
    }),
    "sessions.usage.timeseries": (params) => ({
      sessionId: sessionKeyFrom(params),
      points: [
        {
          timestamp: now - 30_000,
          input: 18_000,
          output: 4_000,
          cacheRead: 3_000,
          cacheWrite: 1_000,
          totalTokens: 26_000,
          cost: 0.38,
          cumulativeTokens: 26_000,
          cumulativeCost: 0.38,
        },
        {
          timestamp: now - 12_000,
          input: 24_000,
          output: 7_000,
          cacheRead: 4_000,
          cacheWrite: 1_000,
          totalTokens: 35_000,
          cost: 0.51,
          cumulativeTokens: 61_000,
          cumulativeCost: 0.89,
        },
        {
          timestamp: now,
          input: 16_000,
          output: 8_000,
          cacheRead: 2_000,
          cacheWrite: 0,
          totalTokens: 23_000,
          cost: 0.53,
          cumulativeTokens: 84_000,
          cumulativeCost: 1.42,
        },
      ],
    }),
    "doctor.memory.status": () => ({
      agentId: "main",
      embedding: {
        ok: true,
      },
      provider: "mock-embedding",
    }),
    "doctor.memory.dreamDiary": () => ({
      agentId: "main",
      content:
        "# Dream diary\n\n- Memory workspace keeps contract-led UI state.\n- Recall search is degraded until LanceDB is available.",
      found: true,
      path: ".openclaw/memory/dream-diary.md",
      updatedAtMs: now - 45_000,
    }),
    "doctor.memory.backfillDreamDiary": () => ({
      action: "backfill",
      agentId: "main",
      changed: true,
      found: true,
      path: ".openclaw/memory/dream-diary.md",
      scannedFiles: 3,
      written: 1,
      warnings: [],
    }),
    "doctor.memory.dedupeDreamDiary": () => ({
      action: "dedupe",
      agentId: "main",
      changed: true,
      dedupedEntries: 2,
      found: true,
      keptEntries: 7,
      path: ".openclaw/memory/dream-diary.md",
      removedEntries: 2,
    }),
    "doctor.memory.repairDreamingArtifacts": () => ({
      action: "repair",
      agentId: "main",
      changed: true,
      found: true,
      path: ".openclaw/memory/dream-diary.md",
      replaced: 1,
      warnings: [],
    }),
    "doctor.memory.resetDreamDiary": () => ({
      action: "reset",
      agentId: "main",
      archiveDir: ".openclaw/memory/archive/mock-reset",
      archivedDreamsDiary: true,
      changed: true,
      found: true,
      removedEntries: 7,
    }),
    "doctor.memory.resetGroundedShortTerm": () => ({
      action: "resetShortTerm",
      agentId: "main",
      archivedSessionCorpus: true,
      archivedSessionIngestion: true,
      changed: true,
      removedShortTermEntries: 4,
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
    let visualMonitorSeeded = false;
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
        if (
          !visualMonitorSeeded &&
          (frame.method === "sessions.subscribe" || frame.method === "sessions.messages.subscribe")
        ) {
          visualMonitorSeeded = true;
          setTimeout(() => sendVisualMonitorEvents(socket), 10);
        }
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
