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
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const visualNodes = [
    {
      nodeId: "node-alpha-control",
      displayName: "Alpha Control Mac",
      platform: "darwin",
      version: "2.1.0",
      coreVersion: "2.1.1",
      uiVersion: "2.1.2",
      deviceFamily: "desktop",
      modelIdentifier: "MacBookPro18,3",
      remoteIp: "127.0.0.1",
      caps: ["chat", "filesystem", "notifications"],
      commands: ["system.notify", "status.request"],
      pathEnv: "/opt/homebrew/bin:/usr/local/bin:/usr/bin",
      permissions: { camera: false, filesystem: true, notifications: true, shell: true },
      connectedAtMs: now - 240_000,
      paired: true,
      connected: true,
    },
    {
      nodeId: "node-beta-field",
      displayName: "Beta Field Node",
      platform: "linux",
      version: "2.0.4",
      coreVersion: "2.0.4",
      uiVersion: "2.0.1",
      deviceFamily: "server",
      modelIdentifier: "x86_64",
      remoteIp: "10.20.0.42",
      caps: ["status", "location"],
      commands: ["status.request", "location.request"],
      pathEnv: "/usr/local/sbin:/usr/local/bin:/usr/bin",
      permissions: { location: true, shell: false },
      connectedAtMs: now - 900_000,
      paired: false,
      connected: false,
    },
    {
      nodeId: "node-ops-tablet",
      displayName: "Ops Tablet",
      platform: "android",
      version: "1.8.0",
      deviceFamily: "mobile",
      modelIdentifier: "Pixel Tablet",
      remoteIp: "10.20.0.65",
      caps: ["notifications"],
      commands: ["system.notify"],
      permissions: { notifications: true },
      connectedAtMs: now - 60_000,
      paired: true,
      connected: true,
    },
  ];
  let visualPairingPending = [
    {
      requestId: "pair-beta-repair",
      nodeId: "node-beta-field",
      displayName: "Beta Field Node",
      platform: "linux",
      remoteIp: "10.20.0.42",
      isRepair: true,
      ts: now - 125_000,
      caps: ["status", "location"],
      commands: ["status.request", "location.request"],
    },
    {
      requestId: "pair-orphan-kiosk",
      nodeId: "node-orphan-kiosk",
      displayName: "Lobby Kiosk",
      platform: "windows",
      remoteIp: "10.20.0.77",
      isRepair: false,
      ts: now - 92_000,
      caps: ["notifications"],
      commands: ["system.notify"],
    },
  ];
  const cronJobs = [
    {
      id: "cron-nightly",
      name: "Nightly workspace sync",
      schedule: { kind: "cron", expr: "0 0 * * *" },
      sessionTarget: "main",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "nightly.workspace.sync" },
      agentId: "main",
      description: "Refresh workspace summaries after hours.",
      enabled: true,
      state: {
        nextRunAtMs: now + 3_600_000,
        lastRunAtMs: now - 90_000,
        lastRunStatus: "ok",
      },
      updatedAtMs: now - 120_000,
      createdAtMs: now - 86_400_000,
    },
    {
      id: "cron-heartbeat",
      name: "Frequent agent heartbeat",
      schedule: { kind: "every", everyMs: 60000 },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "ping" },
      agentId: "ops",
      description: "Disabled fixture for edit and selection coverage.",
      enabled: false,
      state: {
        nextRunAtMs: now + 120_000,
        lastRunAtMs: now - 3_600_000,
        lastRunStatus: "skipped",
      },
      updatedAtMs: now - 240_000,
      createdAtMs: now - 172_800_000,
    },
    {
      id: "cron-weekly",
      name: "Weekly usage digest",
      schedule: { kind: "cron", expr: "0 9 * * 1" },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "weekly.usage.digest" },
      agentId: "main",
      description: "Produce a weekly usage digest.",
      enabled: true,
      state: {
        nextRunAtMs: now + 250_000_000,
        lastRunAtMs: now - 7_200_000,
        lastRunStatus: "ok",
      },
      updatedAtMs: now - 360_000,
      createdAtMs: now - 259_200_000,
    },
  ];
  const cronRunsByJob = {
    "cron-nightly": [
      {
        id: "run-nightly-ok",
        jobId: "cron-nightly",
        status: "ok",
        ts: now - 90_000,
        runAtMs: now - 90_000,
        durationMs: 1842,
        delivery: { channel: "system", delivered: true },
      },
      {
        id: "run-nightly-skipped",
        jobId: "cron-nightly",
        status: "skipped",
        ts: now - 3_690_000,
        runAtMs: now - 3_690_000,
      },
    ],
    "cron-heartbeat": [
      {
        id: "run-heartbeat-error",
        jobId: "cron-heartbeat",
        status: "error",
        ts: now - 180_000,
        runAtMs: now - 180_000,
        durationMs: 512,
        error: "mock heartbeat disabled",
      },
    ],
    "cron-weekly": [
      {
        id: "run-weekly-ok",
        jobId: "cron-weekly",
        status: "ok",
        ts: now - 7_200_000,
        runAtMs: now - 7_200_000,
        durationMs: 2210,
      },
    ],
  };
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
    "agent:main:visual": [
      {
        id: "history-main-visual",
        role: "user",
        content: [{ type: "text", text: "Prepare the visual docs contract handoff." }],
      },
      {
        id: "assistant-main-visual-docs",
        role: "assistant",
        content: [
          {
            type: "text",
            text: `# Docs Contract Chain Field Guide

This specification records how the Deck Docs panel follows the contract chain for list, detail, extraction, and delete routes. The source truth begins in the Deck-facing DTOs, continues through the Go BFF /api/docs routes, and stores extracted documents in the local document registry. The visual fixture is intentionally mock/local evidence only; it does not prove real Gateway LLM extraction quality or production knowledge-base completeness.

Operators should use this document as an implementation guide for category filtering, source session evidence, source agent evidence, Markdown rendering, raw payload disclosure, and confirmation-gated delete behavior. The contract terms include api, schema, protocol, localstore, and handoff so the extracted keywords exercise the Docs workbench filter surface.`,
          },
        ],
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
  let identityHashVersion = 1;
  const identityLinks = [
    {
      canonical: "main",
      peers: [
        { channel: "telegram", peerId: "tg-main" },
        { channel: "discord", peerId: "disc-main" },
        { channel: "wecom", peerId: "wecom-main" },
      ],
    },
    {
      canonical: "builder",
      peers: [{ channel: "slack", peerId: "slack-builder" }],
    },
    {
      canonical: "empty-review-slot",
      peers: [],
    },
  ];
  const identityConfigHash = () => `identity-hash-visual-${identityHashVersion}`;
  const identityResponse = () => ({
    configHash: identityConfigHash(),
    links: clone(identityLinks),
  });
  const bumpIdentityHash = () => {
    identityHashVersion += 1;
    return identityConfigHash();
  };
  const pluginInventory = [
    {
      id: "github",
      name: "GitHub",
      version: "1.2.3",
      origin: "bundled",
      status: "ready",
      enabled: true,
      explicitlyEnabled: true,
      activated: true,
      imported: true,
      activationSource: "config",
      activationReason: "channel enabled in config",
      configPath: "plugins.entries.github.config",
      capabilityKinds: ["channel", "tool"],
      channelIds: ["github", "teams"],
      providerIds: ["github-provider"],
      toolNames: ["issues.search"],
      deckActionCapabilities: { login: true, probe: true, testMessage: false, qrCodeAuth: false },
      diagnostics: [{ level: "warn", message: "token missing" }],
    },
    {
      id: "wecom",
      name: "WeCom",
      version: "0.9.0",
      origin: "bundled",
      status: "ready",
      enabled: true,
      explicitlyEnabled: true,
      activated: true,
      imported: true,
      activationSource: "config",
      activationReason: "wecom channel enabled",
      configPath: "plugins.entries.wecom.config",
      capabilityKinds: ["channel"],
      channelIds: ["wecom"],
      providerIds: [],
      toolNames: [],
      deckActionCapabilities: { login: true, probe: true, testMessage: true, qrCodeAuth: true },
      diagnostics: [],
    },
    {
      id: "slack",
      name: "Slack",
      origin: "workspace",
      status: "error",
      enabled: false,
      explicitlyEnabled: false,
      activated: false,
      imported: true,
      activationSource: "manifest",
      activationReason: "workspace plugin discovered without channel registration",
      configPath: "plugins.entries.slack.config",
      capabilityKinds: ["channel"],
      channelIds: ["slack"],
      providerIds: [],
      toolNames: [],
      deckActionCapabilities: { login: false, probe: false, testMessage: false, qrCodeAuth: false },
      diagnostics: [{ level: "error", message: "channel not visible in Channels" }],
    },
    {
      id: "docs-tools",
      name: "Docs Tools",
      version: "2.4.0",
      origin: "managed",
      status: "ready",
      enabled: true,
      explicitlyEnabled: true,
      activated: true,
      imported: true,
      activationSource: "managed",
      activationReason: "tool provider registered",
      configPath: "plugins.entries.docs-tools.config",
      capabilityKinds: ["tool"],
      channelIds: [],
      providerIds: ["docs-provider"],
      toolNames: ["docs.search", "docs.extract"],
      deckActionCapabilities: { login: false, probe: true, testMessage: false, qrCodeAuth: false },
      diagnostics: [],
    },
  ];
  let configFixture = {
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
  let configHashVersion = 1;
  const configHash = () => `config-hash-visual-${configHashVersion}`;
  const bumpConfigHash = () => {
    configHashVersion += 1;
    return configHash();
  };
  return {
    "gateway.describe": () => ({
      version: "mock-gateway",
      gatewayVersion: "mock-gateway",
      protocol: protocolVersion,
      methods: {
        "deck.agents.list": {
          scope: "operator.read",
          since: 1,
          params: {
            type: "object",
            properties: {
              includeInactive: {
                type: "boolean",
                enum: [true, false],
              },
            },
          },
          result: {
            type: "object",
            required: ["agents"],
            properties: {
              agents: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id"],
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    status: {
                      type: "string",
                      enum: ["active", "inactive", "error"],
                    },
                  },
                },
              },
            },
          },
        },
        "deck.sessions.detail": {
          scope: "operator.read",
          since: 2,
          params: {
            type: "object",
            required: ["sessionKey"],
            properties: {
              sessionKey: { type: "string" },
              includeHistory: { type: "boolean" },
            },
          },
          result: {
            type: "object",
            required: ["session"],
            properties: {
              session: {
                type: "object",
                required: ["key"],
                properties: {
                  key: { type: "string" },
                  agentId: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["active", "completed", "error"],
                  },
                },
              },
            },
          },
        },
        "gateway.describe": {
          scope: "operator.read",
          since: 1,
          params: {
            type: "object",
            properties: {
              includeSchemas: { type: "boolean" },
            },
          },
          result: {
            type: "object",
            properties: {
              methods: { type: "object" },
              events: { type: "object" },
              untyped: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
      events: {
        "activity.event": {
          since: 1,
          payload: {
            type: "object",
            required: ["id", "timestamp", "type", "description"],
            properties: {
              id: { type: "string" },
              timestamp: { type: "number" },
              type: { type: "string" },
              agentId: { type: "string" },
              description: { type: "string" },
            },
          },
        },
        "gateway.ready": {
          since: 1,
          payload: {
            type: "object",
            properties: {
              version: { type: "string" },
              protocol: { type: "number" },
            },
          },
        },
      },
      untyped: ["legacy.raw"],
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
    "cron.list": (params) => {
      const query = String(params?.query ?? "")
        .trim()
        .toLowerCase();
      const enabled = params?.enabled ?? "all";
      const includeDisabled = params?.includeDisabled !== false;
      const filtered = cronJobs.filter((job) => {
        if (!includeDisabled && !job.enabled) {
          return false;
        }
        if (enabled === "enabled" && !job.enabled) {
          return false;
        }
        if (enabled === "disabled" && job.enabled) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          job.name.toLowerCase().includes(query) ||
          job.id.toLowerCase().includes(query) ||
          (job.agentId ?? "").toLowerCase().includes(query)
        );
      });
      return {
        jobs: clone(filtered),
        hasMore: false,
        limit: params?.limit ?? filtered.length,
        nextOffset: filtered.length,
        offset: params?.offset ?? 0,
        total: filtered.length,
      };
    },
    "cron.status": () => {
      const nextWakeAtMs = cronJobs
        .filter((job) => job.enabled)
        .map((job) => job.state?.nextRunAtMs)
        .filter((value) => typeof value === "number")
        .toSorted((left, right) => left - right)[0];
      return {
        enabled: false,
        jobs: cronJobs.length,
        nextWakeAtMs: nextWakeAtMs ?? null,
        storePath: "/tmp/mock-cron.json",
      };
    },
    "cron.runs": (params) => {
      const jobId = params?.jobId ?? params?.id ?? "cron-nightly";
      let entries = clone(cronRunsByJob[jobId] ?? []);
      if (Array.isArray(params?.statuses) && params.statuses.length > 0) {
        entries = entries.filter((entry) => params.statuses.includes(entry.status));
      }
      if (params?.sortDir === "asc") {
        entries.sort((left, right) => left.ts - right.ts);
      } else {
        entries.sort((left, right) => right.ts - left.ts);
      }
      return {
        entries,
        hasMore: false,
        limit: params?.limit ?? entries.length,
        nextOffset: entries.length,
        offset: params?.offset ?? 0,
        total: entries.length,
      };
    },
    "cron.add": (params) => {
      const id = `cron-${
        String(params?.name ?? "job")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-") || "job"
      }`;
      const job = {
        id,
        name: params?.name ?? "Mock cron job",
        schedule: params?.schedule ?? { kind: "cron", expr: "0 9 * * *" },
        sessionTarget: params?.sessionTarget ?? "main",
        wakeMode: params?.wakeMode ?? "now",
        payload: params?.payload ?? { kind: "systemEvent", text: "mock.created" },
        agentId: params?.agentId ?? "main",
        description: params?.description ?? "",
        enabled: params?.enabled !== false,
        state: {
          nextRunAtMs: now + 86_400_000,
        },
        updatedAtMs: Date.now(),
        createdAtMs: Date.now(),
      };
      cronJobs.unshift(job);
      cronRunsByJob[id] = [];
      return clone(job);
    },
    "cron.update": (params) => {
      const id = params?.id ?? params?.jobId ?? "cron-nightly";
      const patch = params?.patch && typeof params.patch === "object" ? params.patch : params;
      const index = cronJobs.findIndex((job) => job.id === id);
      if (index < 0) {
        return { ok: false, id, error: "not_found" };
      }
      cronJobs[index] = {
        ...cronJobs[index],
        ...patch,
        id,
        updatedAtMs: Date.now(),
      };
      return clone(cronJobs[index]);
    },
    "cron.run": (params) => {
      const jobId = params?.id ?? params?.jobId ?? "cron-nightly";
      const run = {
        id: `run-${jobId}-${Date.now()}`,
        jobId,
        status: "ok",
        ts: Date.now(),
        runAtMs: Date.now(),
        durationMs: 333,
      };
      (cronRunsByJob[jobId] ??= []).unshift(run);
      return { ok: true, ran: true, runId: run.id, mode: params?.mode ?? "due" };
    },
    "cron.remove": (params) => {
      const id = params?.id ?? params?.jobId ?? "";
      const index = cronJobs.findIndex((job) => job.id === id);
      if (index >= 0) {
        cronJobs.splice(index, 1);
      }
      return { ok: true, removed: index >= 0 };
    },
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
    "deck.plugins.list": (params) => ({
      scope: "workspace",
      plugins: clone(
        params?.capability === "all"
          ? pluginInventory
          : pluginInventory.filter((plugin) => plugin.capabilityKinds.includes("channel")),
      ),
    }),
    "deck.identity.list": () => identityResponse(),
    "deck.identity.link": (params) => {
      const canonical = String(params?.canonical ?? "").trim();
      const channel = String(params?.channel ?? "").trim();
      const peerId = String(params?.peerId ?? "").trim();
      if (canonical && channel && peerId) {
        let link = identityLinks.find((entry) => entry.canonical === canonical);
        if (!link) {
          link = { canonical, peers: [] };
          identityLinks.push(link);
        }
        if (!link.peers.some((peer) => peer.channel === channel && peer.peerId === peerId)) {
          link.peers.push({ channel, peerId });
        }
      }
      return { ok: true, canonical, configHash: bumpIdentityHash() };
    },
    "deck.identity.unlink": (params) => {
      const canonical = String(params?.canonical ?? "").trim();
      const channel = String(params?.channel ?? "").trim();
      const peerId = String(params?.peerId ?? "").trim();
      const link = identityLinks.find((entry) => entry.canonical === canonical);
      if (link) {
        link.peers = link.peers.filter(
          (peer) => !(peer.channel === channel && peer.peerId === peerId),
        );
      }
      return { ok: true, canonical, configHash: bumpIdentityHash() };
    },
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
      baseHash: configHash(),
      exists: true,
      hash: configHash(),
      path: "/tmp/mock-openclaw.json",
      raw: JSON.stringify(configFixture, null, 2),
      valid: true,
      config: configFixture,
    }),
    "config.schema.lookup": (params) => {
      const path = params?.path ?? "models.providers";
      if (path === "") {
        return {
          path,
          schema: { type: "object" },
          children: Object.keys(configFixture).map((key) => ({
            key,
            path: key,
            required: false,
            hasChildren: true,
          })),
        };
      }
      if (path === "agents.defaults") {
        return {
          path,
          schema: {
            type: "object",
            properties: {
              thinking: { type: "string", enum: ["low", "medium", "high"] },
              runTimeoutSeconds: { type: "number" },
              requireAgentId: { type: "boolean" },
              model: { type: "string" },
              openaiApiKeyEnv: { type: "string" },
              bedrockDiscovery: { type: "object" },
            },
          },
          children: [
            {
              key: "thinking",
              path: "agents.defaults.subagents.thinking",
              type: "string",
              required: false,
              hasChildren: false,
              hint: { label: "Thinking", enum: ["low", "medium", "high"], tags: ["common"] },
            },
            {
              key: "runTimeoutSeconds",
              path: "agents.defaults.subagents.runTimeoutSeconds",
              type: "number",
              required: false,
              hasChildren: false,
              hint: { label: "Run timeout", tags: ["runtime"] },
            },
            {
              key: "requireAgentId",
              path: "agents.defaults.subagents.requireAgentId",
              type: "boolean",
              required: false,
              hasChildren: false,
              hint: { label: "Require agent id", tags: ["runtime"] },
            },
            {
              key: "model",
              path: "agents.defaults.subagents.model",
              type: "string",
              required: false,
              hasChildren: false,
              hint: { label: "Subagent model", placeholder: "openai/gpt-5.4" },
            },
            {
              key: "openaiApiKeyEnv",
              path: "models.providers.openai.apiKeyEnv",
              type: "string",
              required: false,
              hasChildren: false,
              hint: { label: "OpenAI API key env", sensitive: true, tags: ["sensitive"] },
            },
            {
              key: "bedrockDiscovery",
              path: "models.bedrockDiscovery",
              type: "object",
              required: false,
              hasChildren: true,
              hint: { tags: ["advanced"] },
            },
          ],
        };
      }
      return {
        path,
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
      };
    },
    "config.apply": (params) => {
      if (typeof params?.raw === "string") {
        try {
          configFixture = JSON.parse(params.raw);
        } catch {
          // The frontend validates raw JSON before apply; keep the last fixture as fallback.
        }
      }
      return {
        ok: true,
        baseHash: params?.baseHash ?? configHash(),
        hash: bumpConfigHash(),
        raw: JSON.stringify(configFixture, null, 2),
      };
    },
    "config.patch": (params) => ({
      ok: true,
      baseHash: params?.baseHash ?? configHash(),
      hash: bumpConfigHash(),
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
    "node.list": () => ({ nodes: clone(visualNodes), ts: now }),
    "node.describe": (params) => {
      const nodeId = params?.nodeId ?? "node-alpha-control";
      const node = visualNodes.find((item) => item.nodeId === nodeId);
      if (node) {
        return { ...clone(node), ts: Date.now() };
      }
      return {
        nodeId,
        caps: [],
        commands: [],
        connected: false,
        paired: false,
        platform: "unknown",
        ts: Date.now(),
      };
    },
    "node.rename": (params) => {
      const nodeId = params?.nodeId ?? "";
      const displayName = String(params?.displayName ?? "").trim();
      const node = visualNodes.find((item) => item.nodeId === nodeId);
      if (node && displayName) {
        node.displayName = displayName;
      }
      return { ok: Boolean(node && displayName), nodeId, displayName };
    },
    "node.invoke": (params) => ({
      ok: true,
      nodeId: params?.nodeId ?? "node-alpha-control",
      command: params?.command ?? "system.notify",
      payload: {
        delivered: true,
        idempotencyKey: params?.idempotencyKey ?? "mock-node-invoke",
        params: params?.params ?? {},
        timeoutMs: params?.timeoutMs ?? 15000,
      },
      payloadJSON: JSON.stringify({
        delivered: true,
        command: params?.command ?? "system.notify",
      }),
    }),
    "node.pending.enqueue": (params) => ({
      nodeId: params?.nodeId ?? "node-alpha-control",
      revision: 7,
      queued: {
        id: "pending-node-work-visual",
        type: params?.type ?? "status.request",
        priority: params?.priority ?? "normal",
      },
      wakeTriggered: params?.wake !== false,
    }),
    "node.pair.list": () => ({
      pending: clone(visualPairingPending),
      paired: clone(visualNodes.filter((node) => node.paired)),
    }),
    "node.pair.request": (params) => {
      const request = {
        requestId: `pair-${params?.nodeId ?? "new-node"}-visual`,
        nodeId: params?.nodeId ?? "new-node",
        displayName: params?.displayName,
        platform: params?.platform,
        remoteIp: params?.remoteIp,
        isRepair: false,
        ts: Date.now(),
        caps: params?.caps ?? [],
        commands: params?.commands ?? [],
      };
      visualPairingPending = [
        request,
        ...visualPairingPending.filter((item) => item.nodeId !== request.nodeId),
      ];
      return { status: "pending", request: clone(request), created: true };
    },
    "node.pair.approve": (params) => {
      const requestId = params?.requestId ?? "pair-beta-repair";
      const request = visualPairingPending.find((item) => item.requestId === requestId);
      visualPairingPending = visualPairingPending.filter((item) => item.requestId !== requestId);
      const node = request
        ? (visualNodes.find((item) => item.nodeId === request.nodeId) ?? {
            nodeId: request.nodeId,
            displayName: request.displayName,
            platform: request.platform,
            remoteIp: request.remoteIp,
            caps: request.caps ?? [],
            commands: request.commands ?? [],
            connected: false,
            paired: true,
          })
        : visualNodes[0];
      node.paired = true;
      return {
        requestId,
        node: {
          ...clone(node),
          token: "visual-node-token",
          createdAtMs: now - 240_000,
          approvedAtMs: Date.now(),
        },
      };
    },
    "node.pair.reject": (params) => {
      const requestId = params?.requestId ?? "pair-beta-repair";
      const request = visualPairingPending.find((item) => item.requestId === requestId);
      visualPairingPending = visualPairingPending.filter((item) => item.requestId !== requestId);
      return { requestId, nodeId: request?.nodeId ?? "node-beta-field" };
    },
    "node.pair.verify": (params) => ({
      node: {
        ...clone(visualNodes.find((item) => item.nodeId === params?.nodeId) ?? visualNodes[0]),
        token: params?.token ?? "visual-node-token",
        createdAtMs: now - 240_000,
        approvedAtMs: Date.now(),
      },
      requestId: `verify-${params?.nodeId ?? "node-alpha-control"}`,
      verified: true,
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
    "skills.status": () => ({
      managedSkillsDir: "/tmp/openclaw-skills",
      workspaceDir: "/tmp/openclaw-main",
      skills: [
        {
          skillKey: "github",
          name: "GitHub",
          source: "plugin",
          description: "Manage pull requests, issues, and repository automation through gh.",
          emoji: "$",
          primaryEnv: "GITHUB_TOKEN",
          disabled: false,
          eligible: false,
          config: {
            apiKey: "visual-token",
            env: {
              GITHUB_TOKEN: "visual-token",
              GH_HOST: "github.com",
            },
          },
          install: [{ id: "brew-gh", kind: "brew", label: "Install GitHub CLI", bins: ["gh"] }],
          missing: {
            env: ["GITHUB_TOKEN"],
            bins: ["gh"],
            config: [],
            anyBins: [],
            os: [],
          },
          requirements: {
            env: ["GITHUB_TOKEN"],
            bins: ["gh"],
            config: [],
            anyBins: [],
            os: [],
          },
        },
        {
          skillKey: "shell",
          name: "Shell",
          source: "bundled",
          description: "Run local shell commands with approval-aware execution.",
          primaryEnv: "PATH",
          disabled: false,
          eligible: true,
          install: [],
          missing: {
            env: [],
            bins: [],
            config: [],
            anyBins: [],
            os: [],
          },
        },
        {
          skillKey: "frontend-design",
          name: "Frontend Design",
          source: "managed",
          description:
            "Generate high-fidelity frontend prototypes from contracts and design tokens.",
          disabled: false,
          eligible: true,
          install: [],
          missing: {
            env: [],
            bins: [],
            config: [],
            anyBins: [],
            os: [],
          },
        },
        {
          skillKey: "legacy-browser",
          name: "Legacy Browser",
          source: "plugin",
          description:
            "Legacy browser automation surface kept disabled for visual fixture coverage.",
          disabled: true,
          eligible: true,
          install: [],
          missing: {
            env: [],
            bins: [],
            config: [],
            anyBins: [],
            os: [],
          },
        },
      ],
    }),
    "skills.update": (params) => ({
      ok: true,
      skillKey: params?.skillKey ?? params?.slug ?? "github",
      config: {
        enabled: params?.enabled,
        apiKey: params?.apiKey,
        env: params?.env,
        source: params?.source,
        all: params?.all,
      },
    }),
    "skills.install": (params) => ({
      ok: true,
      code: 0,
      message: params?.source === "clawhub" ? "Installed from ClawHub" : "Installed skill option",
      slug: params?.slug,
      stdout: params?.slug ? `installed ${params.slug}` : `installed ${params?.name ?? "skill"}`,
      stderr: "",
      targetDir: "/tmp/openclaw-skills",
      version: params?.version ?? "1.0.0",
      warnings: [],
    }),
    "skills.bins": () => ({
      bins: ["dev", "ops", "research"],
    }),
    "skills.search": (params) => ({
      results: [
        {
          slug: "git-helper",
          displayName: "Git Helper",
          summary: `Manage git workflows for ${params?.query ?? "git"}`,
          version: "1.0.0",
          score: 0.98,
          updatedAt: now - 48 * 60 * 60 * 1_000,
        },
        {
          slug: "frontend-lint",
          displayName: "Frontend Lint",
          summary: "Run design-system-aware frontend checks.",
          version: "0.4.1",
          score: 0.78,
          updatedAt: now - 96 * 60 * 60 * 1_000,
        },
      ],
    }),
    "skills.detail": (params) => ({
      skill: {
        slug: params?.slug ?? "git-helper",
        displayName: "Git Helper",
        summary: "Manage git workflows and repository hygiene.",
        tags: { category: "dev", trust: "mock" },
        createdAt: now - 30 * 24 * 60 * 60 * 1_000,
        updatedAt: now - 48 * 60 * 60 * 1_000,
      },
      latestVersion: {
        version: "1.0.0",
        createdAt: now - 48 * 60 * 60 * 1_000,
        changelog: "Initial visual fixture release.",
      },
      metadata: {
        os: ["darwin", "linux"],
        systems: ["git"],
      },
      owner: {
        handle: "clawhub",
        displayName: "ClawHub",
      },
    }),
    "deck.agents.skills.get": (params) => {
      const agentId = params?.agentId ?? "main";
      const available = [
        { key: "github", name: "GitHub", eligible: true, assigned: agentId !== "qa" },
        { key: "shell", name: "Shell", eligible: true, assigned: true },
        {
          key: "frontend-design",
          name: "Frontend Design",
          eligible: true,
          assigned: agentId === "builder",
        },
      ];
      if (agentId === "main") {
        return {
          agentId,
          mode: "all",
          skills: ["github", "shell", "frontend-design"],
          available,
          configHash: "skills-main-1",
        };
      }
      const skills = available.filter((entry) => entry.assigned).map((entry) => entry.key);
      return {
        agentId,
        mode: "whitelist",
        skills,
        available,
        configHash: `skills-${agentId}-1`,
      };
    },
    "deck.agents.skills.set": (params) => ({
      ok: true,
      agentId: params?.agentId ?? "builder",
      mode: params?.mode ?? "whitelist",
      skills: params?.skills ?? ["github", "shell"],
      configHash: `${params?.baseHash ?? "skills-builder-1"}-saved`,
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
      {
        id: "approval-2",
        createdAtMs: Date.now() - 5_000,
        expiresAtMs: Date.now() + 120_000,
        request: {
          command: "pnpm build",
          commandArgv: ["pnpm", "build"],
          agentId: "builder",
          sessionKey: "session:mock:2",
          runId: "run:mock:2",
          cwd: "/tmp/openclaw-main/deck-go",
        },
      },
    ],
    "exec.approval.resolve": (params) => ({
      ok: true,
      id: params.id ?? "approval-1",
      decision: params.decision ?? "allow-once",
    }),
    "exec.approvals.set": (params) => ({
      exists: true,
      hash: "hash-2",
      path: "/tmp/mock-approvals.json",
      file: params.file ?? {
        defaults: { security: "allowlist", ask: "on-miss" },
        agents: {},
        allowlist: [],
      },
    }),
    "plugin.approval.list": () => ({
      entries: [
        {
          id: "plugin-ap-1",
          pluginId: "wecom",
          command: "connect workspace",
          description: "Allow the plugin to connect a workspace.",
          createdAtMs: Date.now() - 2_000,
          expiresAtMs: Date.now() + 90_000,
          status: "pending",
        },
        {
          id: "plugin-ap-resolved",
          pluginId: "discord",
          command: "sync channel",
          description: "Already resolved.",
          createdAtMs: Date.now() - 40_000,
          expiresAtMs: Date.now() + 90_000,
          status: "resolved",
          decision: "allow-once",
        },
      ],
    }),
    "plugin.approval.resolve": (params) => ({
      ok: true,
      id: params.id ?? "plugin-ap-1",
      decision: params.decision ?? "allow-once",
    }),
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
