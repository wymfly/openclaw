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

function visualDocsAssistantMessage(id, title, category, keywords, focus) {
  const categoryHints = {
    summary: "summary recap overview conclusion summary overview recap",
    plan: "plan roadmap milestone timeline schedule plan roadmap",
    spec: "spec specification api protocol schema contract spec api schema",
    manual: "manual guide tutorial how-to instructions manual guide",
    draft: "draft idea brainstorm notes draft notes idea",
  };
  return {
    id,
    role: "assistant",
    content: [
      {
        type: "text",
        text: `# ${title}

This ${category} document records ${focus}. It is part of the Deck Docs visual fixture and intentionally repeats category vocabulary so the runtime extractor produces realistic keyword chips and category placement: ${categoryHints[category] ?? category}.

## Source chain

The source truth starts in the Deck-facing document shape, passes through the Go BFF docs list, detail, extract, and delete routes, and then lands in the local document registry. Browser code must stay on the BFF side and must not call the Gateway, localstore, or workspace files directly.

## Operator evidence

Operators use this note to verify search, category grouping, source session provenance, Markdown rendering, related document discovery, outline extraction, payload disclosure, and confirmation-gated delete behavior. Keywords for this fixture include ${keywords.join(", ")}.

## Follow-up

Future product work can add server-side search, soft archive, inline editing, richer Markdown highlighting, and durable audit history once those contracts are designed.`,
      },
    ],
  };
}

function visualDocsAssistantMessages() {
  return [
    [
      "assistant-doc-architecture",
      "Architecture overview - May 4 sync",
      "summary",
      ["architecture", "bff", "gateway", "summary"],
      "the layered relationship between frontend-new, deck-go backend, and Gateway",
    ],
    [
      "assistant-doc-gateway-protocol",
      "Gateway protocol generation - Apr 30 review",
      "summary",
      ["protocol", "schema", "codegen", "summary"],
      "how generated Gateway types feed the Deck-facing contract chain",
    ],
    [
      "assistant-doc-events",
      "Event bus and subscriptions - research notes",
      "summary",
      ["events", "subscriptions", "summary"],
      "how event streams become readable operator evidence",
    ],
    [
      "assistant-doc-upgrade-plan",
      "deck-go upgrade plan - v0.6.0",
      "plan",
      ["roadmap", "milestone", "plan"],
      "a milestone roadmap for upgrading the control surface safely",
    ],
    [
      "assistant-doc-agents-sessions",
      "Agents vs. sessions - terminology",
      "spec",
      ["agents", "sessions", "spec", "api"],
      "the difference between persistent agent configuration and session execution",
    ],
    [
      "assistant-doc-scope-model",
      "Scope model (read / write / admin)",
      "spec",
      ["security", "scope", "schema", "spec"],
      "the operator scope contract and approval boundary",
    ],
    [
      "assistant-doc-supervisor",
      "Supervisor lifecycle",
      "spec",
      ["runtime", "supervisor", "protocol"],
      "how bundled Gateway ownership and restart behavior are described",
    ],
    [
      "assistant-doc-dto",
      "DTO authority chain",
      "spec",
      ["contracts", "dto", "schema"],
      "why source contracts and generated artifacts remain the code truth",
    ],
    [
      "assistant-doc-approval",
      "Approval policy schema",
      "spec",
      ["approval", "policy", "schema"],
      "how approval requests are represented before execution",
    ],
    [
      "assistant-doc-bundled",
      "Bundled mode setup",
      "manual",
      ["runtime", "bundled", "manual", "guide"],
      "the operator instructions for running bundled mode",
    ],
    [
      "assistant-doc-remote",
      "Remote mode setup",
      "manual",
      ["runtime", "remote", "manual", "guide"],
      "the operator instructions for connecting to a remote Gateway",
    ],
    [
      "assistant-doc-flaky",
      "Diagnose a flaky channel - draft",
      "draft",
      ["draft", "notes", "channel"],
      "a draft troubleshooting note for channel instability",
    ],
  ].map(([id, title, category, keywords, focus]) =>
    visualDocsAssistantMessage(id, title, category, keywords, focus),
  );
}

function visualMonitorEvents(now = Date.now()) {
  const sessionKey = "agent:main:visual";
  const runId = "run-visual-1";
  const events = [
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
  const activityTypes = [
    ["agent.start", "Architect booted for migration review", "agent=architect"],
    [
      "agent.handoff",
      "Handed off math step 7 verification to Architect",
      "depth=3 · confidence=0.82",
    ],
    ["tool.call", "Batch grep repo tree -conflict", "cwd=/workspace/openclaw"],
    ["tool.result", "Tool result returned 42 matches", "duration=812ms"],
    ["message.in", "User continue with US-009 subagents", "channel=deck"],
    ["message.out", "Reply sent: setting up subagents v2 scaffold", "tokens=1830"],
    ["subagent.spawn", "Spawned Architect for nigh verification", "task=review plan"],
    ["subagent.steer", "Steered reviewer toward contract delta", "target=reviewer"],
    ["channel.connect", "Discord bridge connected", "latency=37ms"],
    ["channel.disconnect", "WeCom webhook disconnected", "retry=scheduled"],
    ["config.change", "Runtime config reloaded", "openclaw.json"],
    ["auth.rotate", "Gateway token rotated", "scope=local"],
    ["alert.fire", "Budget burn-rate alert fired", "threshold=80"],
    ["approval.request", "Command approval requested", "echo visual-fixture"],
    ["approval.grant", "Approval granted once", "operator=main"],
    ["approval.deny", "Approval denied for unsafe command", "policy=deny"],
    ["agent.error", "Agent run reported recoverable failure", "phase=tool"],
    ["tool.deny", "Tool call denied by policy", "tool=write_file"],
    ["channel.error", "Slack channel heartbeat failed", "transport timeout"],
    ["run.completed", "Trace replay completed", "run=run-visual-trace"],
    ["session.created", "Session opened from visual fixture", "session=agent:main:visual-extra"],
  ];
  Array.from({ length: 56 }, (_, index) => {
    const template = activityTypes[index % activityTypes.length];
    return [template[0], `${template[1]} #${index + 1}`, `${template[2]} · sample=${index + 1}`];
  }).forEach(([type, description, details], index) => {
    const agentId = index % 5 === 0 ? "" : ["main", "architect", "executor", "reviewer"][index % 4];
    events.push({
      event: "activity.event",
      payload: {
        id: `activity-visual-extra-${index + 1}`,
        timestamp: now - (index + 2) * 92_000,
        type,
        ...(agentId
          ? {
              agentId,
              agentName: `${agentId[0].toUpperCase()}${agentId.slice(1)} Agent`,
            }
          : {}),
        description,
        details,
      },
    });
  });
  return events;
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
  const coreLogLines = [
    `${new Date(now - 42_000).toISOString()} [INFO] [gateway] gateway ready sessionKey=sess-main bind=127.0.0.1:18789 runtime=bundled`,
    `${new Date(now - 36_000).toISOString()} [WARN] [agent] tool retry scheduled sessionKey=sess-build method=deck.agents.chat.start attempt=2 correlationId=trace-build-42 retryAfterMs=1200`,
    `${new Date(now - 29_000).toISOString()} [DEBUG] [channel] websocket heartbeat acknowledged sessionKey=sess-main channel=discord account=ops-bot`,
    `${new Date(now - 22_000).toISOString()} [ERROR] [agent] agent handoff failed sessionKey=sess-build correlationId=trace-build-42 reason="mock upstream timeout for visual fixture" model=gpt-5.4 step=73 tokens=4124`,
    `${new Date(now - 18_000).toISOString()} [INFO] [deck-bff] deck bff projected logs.tail payload sessionKey=sess-main correlationId=trace-bff-17 endpoint="GET /logs" latencyMs=24`,
    `${new Date(now - 12_000).toISOString()} [INFO] [gateway] logs.tail served cursor=${logCursor} sessionKey=sess-main`,
  ];
  const logSources = [
    "gateway",
    "agent",
    "channel",
    "tool",
    "deck-bff",
    "scheduler",
    "router",
    "http",
  ];
  const logSessions = [
    "sess-main",
    "sess-build",
    "sess-cron",
    "sess-onboarding",
    "sess-tools",
    "sess-feedback",
    "sess-codex",
    "sess-e2e",
    "sess-triage",
  ];
  const generatedLogLines = Array.from({ length: 118 }, (_, index) => {
    const source = logSources[index % logSources.length];
    const sessionKey = logSessions[index % logSessions.length];
    const level =
      index % 17 === 0 ? "ERROR" : index % 9 === 0 ? "WARN" : index % 7 === 0 ? "DEBUG" : "INFO";
    const correlationId =
      index < 5
        ? "trace-build-42"
        : index % 2 === 0
          ? `trace-mock-${String(index).padStart(3, "0")}`
          : "";
    const messageBySource = {
      agent: `agent step ${index} completed model=gpt-5.4 tokens=${3200 + index}`,
      channel: `channel delivery acknowledged channel=discord offset=${2300 + index}`,
      "deck-bff": `projection refresh endpoint=GET:/logs latencyMs=${18 + (index % 31)}`,
      gateway: `gateway rpc completed method=deck.logs.tail durationMs=${12 + (index % 19)}`,
      http: `http request GET /api/deck/${source}/${index} status=200`,
      router: `route shadow method=deck.legacy.${index} selected=main`,
      scheduler: `cron wake processed job=maintenance-${index % 6}`,
      tool: `tool call success name=read_file seq=${index}`,
    };
    return [
      new Date(now - 48_000 - index * 7_000).toISOString(),
      `[${level}]`,
      `[${source}]`,
      messageBySource[source],
      `sessionKey=${sessionKey}`,
      correlationId ? `correlationId=${correlationId}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  });
  const logLines = [...coreLogLines, ...generatedLogLines];
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
      version: "2.1.0",
      coreVersion: "2.0.4",
      uiVersion: "2.1.0",
      deviceFamily: "linux-arm64",
      modelIdentifier: "Raspberry Pi 5",
      remoteIp: "10.20.0.42",
      caps: ["status", "location"],
      commands: ["status.request"],
      pathEnv: "/usr/local/sbin:/usr/local/bin:/usr/bin",
      permissions: { filesystem: true, network: true, shell: false },
      connectedAtMs: now - 21_600_000,
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
    {
      nodeId: "node-gamma-workstation",
      displayName: "Gamma Workstation",
      platform: "windows",
      version: "2.0.9",
      coreVersion: "2.0.9",
      uiVersion: "2.0.9",
      deviceFamily: "windows-x64",
      modelIdentifier: "OptiPlex 7090",
      remoteIp: "10.20.0.77",
      caps: ["chat", "system.notify", "shell"],
      commands: ["chat.send", "system.notify", "status.request"],
      pathEnv: "C:\\Windows\\System32;C:\\Program Files\\OpenClaw",
      permissions: { filesystem: true, network: true, shell: true },
      connectedAtMs: now - 120_000,
      paired: true,
      connected: true,
    },
    {
      nodeId: "node-delta-edge",
      displayName: "Delta Edge Probe",
      platform: "linux",
      version: "2.0.7",
      coreVersion: "2.0.7",
      uiVersion: "2.0.7",
      deviceFamily: "linux-x64",
      modelIdentifier: "Intel NUC 12",
      remoteIp: "10.20.0.91",
      caps: ["status.request"],
      commands: [],
      permissions: { filesystem: false, network: true, shell: false },
      paired: true,
      connected: false,
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
    {
      id: "cron-daily-rollup",
      name: "Daily usage rollup",
      schedule: { kind: "cron", expr: "0 6 * * *", tz: "UTC" },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "agentTurn", message: "roll up yesterday usage" },
      agentId: "main",
      description: "Aggregates per-channel deliveries and writes to usage tables.",
      enabled: true,
      failureAlert: true,
      state: {
        nextRunAtMs: now + 28_800_000,
        lastRunAtMs: now - 28_800_000,
        lastRunStatus: "ok",
      },
      updatedAtMs: now - 14_400_000,
      createdAtMs: now - 1_555_200_000,
    },
    {
      id: "cron-stale-sweep",
      name: "Stale session sweep",
      schedule: { kind: "every", everyMs: 1_800_000, anchorMs: now - 86_400_000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "session.sweep" },
      agentId: "main",
      description: "Closes sessions that have been idle for more than a day.",
      enabled: false,
      state: {
        nextRunAtMs: now + 1_800_000,
        lastRunAtMs: now - 10_800_000,
        lastRunStatus: "ok",
      },
      updatedAtMs: now - 518_400_000,
      createdAtMs: now - 1_900_800_000,
    },
    {
      id: "cron-channel-link-renew",
      name: "Channel link renew",
      schedule: { kind: "every", everyMs: 14_400_000 },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "systemEvent", text: "channel.link.renew" },
      agentId: "ops",
      description: "Refreshes channel OAuth links before expiry.",
      enabled: true,
      failureAlert: true,
      state: {
        nextRunAtMs: now + 8_040_000,
        lastRunAtMs: now - 43_200_000,
        lastRunStatus: "ok",
      },
      updatedAtMs: now - 86_400_000,
      createdAtMs: now - 1_209_600_000,
    },
    {
      id: "cron-snapshot-backup",
      name: "Snapshot backup",
      schedule: { kind: "cron", expr: "0 3 * * *", tz: "UTC" },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "backup.snapshot" },
      agentId: "main",
      description: "Backs up deck-go state to an operator-controlled store.",
      enabled: true,
      failureAlert: true,
      state: {
        nextRunAtMs: now + 18_720_000,
        lastRunAtMs: now - 32_400_000,
        lastRunStatus: "error",
      },
      updatedAtMs: now - 32_400_000,
      createdAtMs: now - 2_419_200_000,
    },
    {
      id: "cron-onboarding-followup",
      name: "Onboarding follow-up",
      schedule: { kind: "at", at: new Date(now + 57_600_000).toISOString() },
      sessionTarget: "isolated",
      wakeMode: "now",
      payload: { kind: "agentTurn", message: "send onboarding nudge" },
      agentId: "main",
      description: "One-shot nudge for a newly added operator.",
      enabled: true,
      deleteAfterRun: true,
      state: {
        nextRunAtMs: now + 57_600_000,
        lastRunAtMs: now - 86_400_000,
        lastRunStatus: "ok",
      },
      updatedAtMs: now - 1_800_000,
      createdAtMs: now - 1_800_000,
    },
    {
      id: "cron-quota-recheck",
      name: "Quota recheck",
      schedule: { kind: "every", everyMs: 900_000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "quota.recheck" },
      agentId: "ops",
      description: "Verifies provider quota windows and demotes exhausted providers.",
      enabled: true,
      failureAlert: true,
      state: {
        nextRunAtMs: now + 540_000,
        lastRunAtMs: now - 360_000,
        lastRunStatus: "skipped",
      },
      updatedAtMs: now - 14_400_000,
      createdAtMs: now - 1_468_800_000,
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
    "cron-daily-rollup": [
      {
        id: "run-daily-rollup-ok",
        jobId: "cron-daily-rollup",
        status: "ok",
        ts: now - 28_800_000,
        runAtMs: now - 28_800_000,
        durationMs: 32412,
      },
      {
        id: "run-daily-rollup-error",
        jobId: "cron-daily-rollup",
        status: "error",
        ts: now - 201_600_000,
        runAtMs: now - 201_600_000,
        durationMs: 8240,
        error: "rollup query timeout",
      },
    ],
    "cron-stale-sweep": [
      {
        id: "run-stale-sweep-ok",
        jobId: "cron-stale-sweep",
        status: "ok",
        ts: now - 10_800_000,
        runAtMs: now - 10_800_000,
        durationMs: 1402,
      },
    ],
    "cron-channel-link-renew": [
      {
        id: "run-channel-link-ok",
        jobId: "cron-channel-link-renew",
        status: "ok",
        ts: now - 43_200_000,
        runAtMs: now - 43_200_000,
        durationMs: 921,
      },
      {
        id: "run-channel-link-error",
        jobId: "cron-channel-link-renew",
        status: "error",
        ts: now - 492_000,
        runAtMs: now - 492_000,
        durationMs: 4320,
        error: "oauth refresh rejected",
      },
    ],
    "cron-snapshot-backup": [
      {
        id: "run-snapshot-error",
        jobId: "cron-snapshot-backup",
        status: "error",
        ts: now - 32_400_000,
        runAtMs: now - 32_400_000,
        durationMs: 4010,
        error: "object store unavailable",
      },
    ],
    "cron-onboarding-followup": [
      {
        id: "run-onboarding-ok",
        jobId: "cron-onboarding-followup",
        status: "ok",
        ts: now - 86_400_000,
        runAtMs: now - 86_400_000,
        durationMs: 8240,
      },
    ],
    "cron-quota-recheck": [
      {
        id: "run-quota-skipped",
        jobId: "cron-quota-recheck",
        status: "skipped",
        ts: now - 360_000,
        runAtMs: now - 360_000,
        durationMs: 14,
        error: "no provider quota changes",
      },
    ],
  };
  const subagentRuns = [
    {
      runId: "run_aa3201",
      childSessionKey: "agent:executor:subagent-aa3201",
      childAgentId: "executor",
      childAgentName: "Executor",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Implement TabAudit error handling in subagents detail view",
      label: "subagents tab audit",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 360_000,
      startedAt: now - 359_200,
      endedAt: now - 240_000,
      durationMs: 124_000,
      status: "completed",
      outcome: { ok: true, filesTouched: ["detail-view.jsx", "styles.css"] },
    },
    {
      runId: "run_bb7401",
      childSessionKey: "agent:architect:subagent-bb7401",
      childAgentId: "architect",
      childAgentName: "Architect",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Verify ralph completion against PRD acceptance criteria",
      label: "ralph step 7 verification",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 90_000,
      startedAt: now - 89_400,
      status: "active",
    },
    {
      runId: "run_cc9101",
      childSessionKey: "agent:explore:subagent-cc9101",
      childAgentId: "explore",
      childAgentName: "Explore",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Find DeckGoSubagent DTOs in contract source",
      label: "contract DTO grep",
      model: "openai/gpt-5.4-mini",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 720_000,
      startedAt: now - 719_600,
      endedAt: now - 690_000,
      durationMs: 30_000,
      status: "completed",
      outcome: { ok: true, hits: 14 },
    },
    {
      runId: "run_dd5512",
      childSessionKey: "agent:executor:subagent-dd5512",
      childAgentId: "executor",
      childAgentName: "Executor",
      requesterSessionKey: "agent:executor:subagent-aa3201",
      requesterAgentId: "executor",
      requesterAgentName: "Executor",
      task: "Run pnpm tsc --noEmit on dirty files",
      label: "type check sub",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 2,
      createdAt: now - 300_000,
      startedAt: now - 299_800,
      endedAt: now - 291_000,
      durationMs: 9_000,
      status: "completed",
      outcome: { ok: true, errors: 0, warnings: 4 },
    },
    {
      runId: "run_ee2231",
      childSessionKey: "agent:critic:subagent-ee2231",
      childAgentId: "critic",
      childAgentName: "Critic",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Review channels prototype v2 for adherence to design system",
      label: "channels review",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 1_500_000,
      startedAt: now - 1_498_800,
      endedAt: now - 1_320_000,
      durationMs: 180_000,
      status: "completed",
      outcome: { verdict: "APPROVE", issues: 0 },
    },
    {
      runId: "run_ff8801",
      childSessionKey: "agent:executor:subagent-ff8801",
      childAgentId: "executor",
      childAgentName: "Executor",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Migrate test fixtures from sql.js to JSON",
      label: "fixtures migration",
      model: "openai/gpt-5.4",
      spawnMode: "background",
      depth: 1,
      createdAt: now - 3_000_000,
      startedAt: now - 2_999_400,
      endedAt: now - 2_280_000,
      durationMs: 720_000,
      status: "completed",
      outcome: { ok: true, filesTouched: 47 },
    },
    {
      runId: "run_gg1010",
      childSessionKey: "agent:verifier:subagent-gg1010",
      childAgentId: "verifier",
      childAgentName: "Verifier",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Verify completed sql.js migration against acceptance criteria",
      label: "post-migration verify",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 2_160_000,
      startedAt: now - 2_159_800,
      endedAt: now - 2_100_000,
      durationMs: 60_000,
      status: "completed",
      outcome: { verdict: "PASS" },
    },
    {
      runId: "run_hh4422",
      childSessionKey: "agent:executor:subagent-hh4422",
      childAgentId: "executor",
      childAgentName: "Executor",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Refactor wecom plugin pending-reply queue with bounded retry",
      label: "wecom retry hardening",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 12_000_000,
      startedAt: now - 11_999_200,
      endedAt: now - 11_880_000,
      durationMs: 100_000,
      status: "failed",
      outcome: { reason: "user-requested kill" },
    },
    {
      runId: "run_ii7733",
      childSessionKey: "agent:scientist:subagent-ii7733",
      childAgentId: "scientist",
      childAgentName: "Scientist",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Analyze cache hit rate after prompt cache changes",
      label: "cache hit analysis",
      model: "openai/gpt-5.4-mini",
      spawnMode: "background",
      depth: 1,
      createdAt: now - 4_500_000,
      startedAt: now - 4_499_700,
      endedAt: now - 4_200_000,
      durationMs: 300_000,
      status: "completed",
      outcome: { hitRate: 0.84, sample: 1240 },
    },
    {
      runId: "run_jj9101",
      childSessionKey: "agent:executor:subagent-jj9101",
      childAgentId: "executor",
      childAgentName: "Executor",
      requesterSessionKey: "agent:executor:subagent-aa3201",
      requesterAgentId: "executor",
      requesterAgentName: "Executor",
      task: "Update components.md with new prop shapes",
      label: "docs sub",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 2,
      createdAt: now - 240_000,
      startedAt: now - 239_800,
      endedAt: now - 220_000,
      durationMs: 20_000,
      status: "completed",
      outcome: { ok: true },
    },
    {
      runId: "run_kk2222",
      childSessionKey: "agent:test-engineer:subagent-kk2222",
      childAgentId: "test-engineer",
      childAgentName: "Test Engineer",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Add e2e Playwright spec for skills install flow",
      label: "skills e2e",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 900_000,
      startedAt: now - 899_800,
      status: "active",
    },
    {
      runId: "run_ll5555",
      childSessionKey: "agent:executor:subagent-ll5555",
      childAgentId: "executor",
      childAgentName: "Executor",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Patch Discord HELLO timeout flake in CI",
      label: "discord ci flake",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 32_400_000,
      startedAt: now - 32_399_600,
      endedAt: now - 31_560_000,
      durationMs: 840_000,
      status: "failed",
      outcome: { error: "tsc failed: 23 errors" },
    },
    {
      runId: "run_mm6611",
      childSessionKey: "agent:writer:subagent-mm6611",
      childAgentId: "writer",
      childAgentName: "Writer",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Draft RELEASE_NOTES for 0.4.2 against the closed PRs",
      label: "release notes",
      model: "openai/gpt-5.4-mini",
      spawnMode: "background",
      depth: 1,
      createdAt: now - 7_200_000,
      startedAt: now - 7_199_800,
      endedAt: now - 6_960_000,
      durationMs: 240_000,
      status: "completed",
      outcome: { ok: true, drafted: "RELEASE_NOTES_v0.4.2.md" },
    },
    {
      runId: "run_nn7700",
      childSessionKey: "agent:tracer:subagent-nn7700",
      childAgentId: "tracer",
      childAgentName: "Tracer",
      requesterSessionKey: "agent:main:main",
      requesterAgentId: "main",
      requesterAgentName: "Main",
      task: "Trace cache miss in fetchSkills",
      label: "trace skills cache",
      model: "openai/gpt-5.4",
      spawnMode: "blocking",
      depth: 1,
      createdAt: now - 480_000,
      startedAt: now - 479_800,
      durationMs: 480_000,
      status: "timeout",
    },
  ];
  const subagentLineageNodes = subagentRuns.map((run) => {
    const parent = subagentRuns.find(
      (candidate) => candidate.childSessionKey === run.requesterSessionKey,
    );
    return {
      runId: run.runId,
      sessionKey: run.childSessionKey,
      agentId: run.childAgentId,
      agentName: run.childAgentName,
      task: run.task,
      depth: run.depth,
      parentRunId: parent?.runId ?? "",
      status: run.status,
      durationMs: run.durationMs,
    };
  });
  const threadBindings = [
    {
      threadId: "thr-discord-ops-1",
      channelId: "discord:ops-zone#alerts",
      agentId: "main",
      targetSessionKey: "sess-main",
      targetKind: "claude-code-session",
      boundAt: now - 604_800_000,
      lastActivityAt: now - 240_000,
      accountId: "ops-bot",
      boundBy: "operator:ymw@example.com",
      label: "Discord ops alerts -> main session",
    },
    {
      threadId: "thr-telegram-onboarding",
      channelId: "telegram:1284912934",
      agentId: "onboarding",
      targetSessionKey: "sess-onboarding",
      targetKind: "agent-loop",
      boundAt: now - 187_200_000,
      lastActivityAt: now - 1_320_000,
      accountId: "claw-onboard-bot",
      boundBy: "auto-binding",
      label: "Telegram onboarding (auto)",
    },
    {
      threadId: "thr-wecom-eng",
      channelId: "wecom:eng-leads",
      agentId: "build",
      targetSessionKey: "sess-build",
      targetKind: "claude-code-session",
      boundAt: now - 11_640_000,
      lastActivityAt: now - 4_020_000,
      accountId: "service",
      boundBy: "operator:ymw@example.com",
    },
    {
      threadId: "thr-qq-feedback",
      channelId: "qq:909123887",
      agentId: "feedback",
      targetSessionKey: "sess-feedback",
      targetKind: "agent-loop",
      boundAt: now - 950_400_000,
      lastActivityAt: now - 262_800_000,
      accountId: "main",
      boundBy: "auto-binding",
      label: "QQ user feedback intake",
    },
    {
      threadId: "thr-slack-platform",
      channelId: "slack:U0XS41-platform",
      agentId: "platform",
      targetSessionKey: "sess-platform",
      targetKind: "external-bot",
      boundAt: now - 432_000_000,
      lastActivityAt: now - 2_880_000,
      accountId: "slack-platform",
      boundBy: "manual:legacy-importer",
      label: "Slack platform escalation",
    },
    {
      threadId: "thr-discord-incident",
      channelId: "discord:incidents#fire",
      agentId: "incident",
      targetSessionKey: "sess-incident-2026-05-03",
      targetKind: "claude-code-session",
      boundAt: now - 9_540_000,
      lastActivityAt: now - 660_000,
      accountId: "ops-bot",
      boundBy: "operator:ymw@example.com",
      label: "Discord incident channel <-> incident agent",
    },
    {
      threadId: "thr-telegram-cron",
      channelId: "telegram:9181229",
      agentId: "cron",
      targetSessionKey: "sess-cron",
      targetKind: "agent-loop",
      boundAt: now - 1_209_600_000,
      lastActivityAt: now - 604_800_000,
      accountId: "claw-cron-bot",
      boundBy: "auto-binding",
    },
    {
      threadId: "thr-wecom-product",
      channelId: "wecom:product-launch",
      agentId: "research",
      targetSessionKey: "sess-research-7",
      targetKind: "agent-loop",
      boundAt: now - 21_600_000,
      lastActivityAt: now - 8_280_000,
      accountId: "service",
      boundBy: "operator:lin@example.com",
      label: "WeCom product-launch room",
    },
    {
      threadId: "thr-discord-art",
      channelId: "discord:art-tools#design",
      agentId: "designer",
      targetSessionKey: "sess-designer-3",
      targetKind: "claude-code-session",
      boundAt: now - 777_600_000,
      lastActivityAt: now - 46_800_000,
      accountId: "ops-bot",
      boundBy: "operator:ymw@example.com",
    },
    {
      threadId: "thr-slack-finance",
      channelId: "slack:U0XS41-finance",
      agentId: "finance-helper",
      targetSessionKey: "sess-finance-2",
      targetKind: "external-bot",
      boundAt: now - 1_728_000_000,
      lastActivityAt: now - 446_400_000,
      accountId: "slack-finance",
      boundBy: "manual:legacy-importer",
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
      ...visualDocsAssistantMessages(),
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
    channelOrder: ["telegram", "discord", "wecom", "slack", "qq"],
    channels: {
      discord: {
        enabled: true,
        connected: true,
        status: "ready",
        latencyMs: 84,
        messagesIn: 12,
        messagesOut: 9,
      },
      wecom: {
        enabled: true,
        connected: true,
        status: "ready",
        latencyMs: 128,
        messagesIn: 158,
        messagesOut: 65,
      },
      telegram: {
        enabled: false,
        connected: false,
        status: "disabled",
        latencyMs: 0,
        messagesIn: 84,
        messagesOut: 38,
      },
      slack: {
        enabled: false,
        connected: false,
        status: "disabled",
        latencyMs: 0,
        messagesIn: 0,
        messagesOut: 0,
      },
      qq: {
        enabled: true,
        connected: true,
        status: "ready",
        latencyMs: 142,
        messagesIn: 6,
        messagesOut: 3,
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
      slack: [
        {
          accountId: "workspace",
          name: "Slack Workspace",
          enabled: false,
          configured: true,
          linked: false,
          connected: false,
          healthState: "disabled",
          probe: { ok: false, error: "channel disabled" },
        },
      ],
      qq: [],
    },
    channelDefaultAccountId: {
      discord: "enterprise",
      wecom: "default",
      telegram: "alerts",
      slack: "workspace",
      qq: "",
    },
    channelLabels: {
      discord: "Discord",
      wecom: "WeCom",
      telegram: "Telegram",
      slack: "Slack",
      qq: "QQ",
    },
    channelDetailLabels: {
      discord: "Discord workspace bridge",
      wecom: "WeCom operations bridge",
      telegram: "Telegram alert bridge",
      slack: "Slack workspace bridge",
      qq: "QQ bot pending bind",
    },
    channelSystemImages: {
      discord: "discord",
      wecom: "wecom",
      telegram: "telegram",
      slack: "slack",
      qq: "qq",
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
      {
        id: "slack",
        label: "Slack",
        detailLabel: "Slack workspace bridge",
        systemImage: "slack",
        pluginId: "slack",
        pluginOrigin: "local",
        pluginConfigPath: "channels.slack",
      },
      {
        id: "qq",
        label: "QQ",
        detailLabel: "QQ bot pending bind",
        systemImage: "qq",
        pluginId: "qq",
        pluginOrigin: "extension",
        pluginConfigPath: "channels.qq",
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
      canonical: "team-builder",
      peers: [
        { channel: "slack", peerId: "slack-builder" },
        { channel: "slack", peerId: "slack-builder-shadow" },
      ],
    },
    {
      canonical: "ops-rotation",
      peers: [
        { channel: "telegram", peerId: "tg-oncall-bot" },
        { channel: "email", peerId: "oncall@deck.local" },
      ],
    },
    {
      canonical: "review-pool",
      peers: [],
    },
    {
      canonical: "system",
      peers: [{ channel: "discord", peerId: "disc-deckgo-system" }],
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
    agents: {
      list: [
        {
          id: "main",
          skills: ["github", "shell", "frontend-design"],
        },
        {
          id: "ops",
          skills: ["github", "domain-research", "obsidian-markdown"],
        },
      ],
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
          apiKey: { source: "env", provider: "default", id: "OPENAI_API_KEY" },
          models: [
            { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 200000, maxTokens: 8192 },
            { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", contextWindow: 128000, maxTokens: 4096 },
            { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxTokens: 4096 },
          ],
        },
        anthropic: {
          api: "anthropic-messages",
          auth: "api-key",
          baseUrl: "https://api.anthropic.com/v1",
          apiKey: { source: "env", provider: "default", id: "ANTHROPIC_API_KEY" },
          models: [
            { id: "claude-4.6", name: "Claude 4.6", contextWindow: 200000, maxTokens: 8192 },
            { id: "sonnet-4.6", name: "Claude Sonnet 4.6", contextWindow: 200000, maxTokens: 8192 },
          ],
        },
        ollama: {
          api: "ollama",
          auth: "token",
          baseUrl: "http://127.0.0.1:11434/v1",
          models: [
            { id: "llama3.3:70b", name: "Llama 3.3 70B", contextWindow: 128000, maxTokens: 4096 },
          ],
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
    plugins: {
      entries: {
        "docs-tools": {
          enabled: true,
          channels: ["discord", "wecom"],
          capabilities: ["tool", "knowledge"],
        },
        "slack-bridge": {
          enabled: false,
          channels: ["slack"],
          capabilities: ["channel"],
        },
      },
    },
    skills: {
      allowBundled: ["shell", "writing-plans", "self-improve"],
      load: {
        extraDirs: ["/tmp/openclaw-extra-skills"],
      },
      entries: {
        github: {
          enabled: true,
          apiKey: "visual-token",
          env: {
            GITHUB_TOKEN: "visual-token",
            GH_HOST: "github.com",
          },
        },
        "frontend-design": {
          enabled: true,
          env: {
            FIGMA_TOKEN: "redacted-by-bff",
          },
        },
        "domain-research": {
          enabled: true,
          env: {
            OBSIDIAN_VAULT_PATH: "/tmp/openclaw-vault",
          },
        },
        "gpu-server-ops": {
          enabled: false,
        },
      },
    },
    hooks: {
      beforeSend: ["redact-secrets", "route-guard"],
      afterReceive: ["usage-metrics"],
      onError: ["notify-operator"],
    },
    runtime: {
      mode: "bundled",
      gateway: { bind: "127.0.0.1", port: 18789 },
      session: { dmScope: "per-channel-peer" },
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
    },
  };
  let configHashVersion = 1;
  const configHash = () => `config-hash-visual-${configHashVersion}`;
  const bumpConfigHash = () => {
    configHashVersion += 1;
    return configHash();
  };
  const defaultAgentId = "ops";
  const mainKey = "main";
  const agentDefinitions = {
    main: {
      id: "main",
      name: "Main",
      emoji: "M",
      workspace: memoryWorkspaces.main,
      model: "gpt-5.4",
      fallbackModels: ["sonnet-4.6"],
      status: "idle",
      sessionCount: 18,
      bindingCount: 4,
      activeSubagentCount: 2,
      lastActiveAtMs: Date.now() - 60_000,
    },
    ops: {
      id: "ops",
      name: "Ops Runner",
      emoji: "O",
      workspace: memoryWorkspaces.ops,
      model: "gpt-5.4-mini",
      fallbackModels: ["gpt-5.4"],
      status: "busy",
      sessionCount: 7,
      bindingCount: 2,
      activeSubagentCount: 1,
      lastActiveAtMs: Date.now() - 5_000,
    },
    research: {
      id: "research",
      name: "Research",
      emoji: "R",
      workspace: memoryWorkspaces.research,
      model: "gpt-5.4",
      fallbackModels: [],
      status: "offline",
      sessionCount: undefined,
      bindingCount: 1,
      activeSubagentCount: 0,
    },
    builder: {
      id: "builder",
      name: "Builder Agent",
      emoji: "B",
      workspace: memoryWorkspaces.builder,
      model: "gpt-5.4",
      fallbackModels: ["gpt-5.4-mini"],
      status: "busy",
      sessionCount: 5,
      bindingCount: 1,
      activeSubagentCount: 3,
      lastActiveAtMs: Date.now() - 20_000,
    },
    reviewer: {
      id: "reviewer",
      name: "Reviewer Agent",
      emoji: "R",
      workspace: memoryWorkspaces.reviewer,
      model: "gpt-5.4-mini",
      fallbackModels: [],
      status: "idle",
      sessionCount: 3,
      bindingCount: 1,
      activeSubagentCount: 0,
      lastActiveAtMs: Date.now() - 120_000,
    },
    qa: {
      id: "qa",
      name: "QA Agent",
      emoji: "Q",
      workspace: memoryWorkspaces.qa,
      model: "gpt-5.4-mini",
      fallbackModels: [],
      status: "idle",
      sessionCount: 2,
      bindingCount: 0,
      activeSubagentCount: 0,
    },
  };
  const agentDefinitionList = () => Object.values(agentDefinitions);
  const agentProtection = (agentId) => {
    const isMainProtected = agentId === "main";
    const isConfiguredDefault = agentId === defaultAgentId;
    return {
      isDefault: isConfiguredDefault,
      isConfiguredDefault,
      isMainProtected,
      mainKey,
      protectedReasons: isMainProtected
        ? ["main is the protected system/fallback agent and cannot be deleted"]
        : [],
      availableActions: {
        canEditIdentity: true,
        canEditRuntime: true,
        canDelete: !isMainProtected,
        canChangeDefault: false,
        deleteDisabledReason: isMainProtected
          ? "main is the protected system/fallback agent"
          : undefined,
        guardedEditReasons: isMainProtected
          ? ["Runtime edits affect the protected system/fallback agent"]
          : ["Runtime edits can change live agent behavior"],
        unsupportedReasons: ["Default-agent switching is read-only in this pass"],
      },
    };
  };
  const agentSummary = (definition) => ({
    id: definition.id,
    name: definition.name,
    identity: { emoji: definition.emoji, name: definition.name },
    emoji: definition.emoji,
    workspace: definition.workspace,
    model: { primary: definition.model, fallbacks: definition.fallbackModels },
    status: definition.status,
    sessionCount: definition.sessionCount,
    bindingCount: definition.bindingCount,
    lastActiveAtMs: definition.lastActiveAtMs,
    effectiveSources: { workspace: "agent", model: "agent" },
    impact: {
      bindingCount: definition.bindingCount,
      sessionCount: definition.sessionCount,
      activeSubagentCount: definition.activeSubagentCount,
      workspaceFileCount: 3,
      deleteRemovesFiles: false,
    },
    ...agentProtection(definition.id),
  });
  const agentImpact = (definition, operation = "delete-agent") => {
    const bindingCount = definition.bindingCount ?? 0;
    const sessionCount = definition.sessionCount ?? 0;
    return {
      bindingCount,
      sessionCount,
      activeSubagentCount: definition.activeSubagentCount ?? 0,
      workspaceFileCount: 3,
      deleteRemovesFiles: false,
      bindings: {
        count: bindingCount,
        samples: Array.from({ length: Math.min(bindingCount, 2) }, (_, index) => ({
          bindingIndex: index,
          type: index === 0 ? "channel" : "peer",
          channel: index === 0 ? "discord" : "wecom",
          accountId: index === 0 ? "enterprise" : "default",
          peer: { kind: "mock", id: `${definition.id}-peer-${index + 1}` },
          summary: `${definition.name} mock binding ${index + 1}`,
        })),
        truncated: bindingCount > 2,
      },
      sessions: {
        total: sessionCount,
        active: definition.activeSubagentCount ?? 0,
        truncated: false,
      },
      files: {
        total: 3,
        bootstrapPresent: true,
        truncated: false,
      },
      capturedAt: new Date(0).toISOString(),
      available: true,
      unavailableReason: undefined,
      operation,
    };
  };
  const agentDetail = (agentId = "main") => {
    const definition = agentDefinitions[agentId] ?? agentDefinitions.main;
    return {
      id: definition.id,
      name: definition.name,
      workspace: definition.workspace,
      model: definition.model,
      reasoningDefault: definition.id === "main" ? "stream" : "on",
      fastModeDefault: definition.id === "ops",
      bindingCount: definition.bindingCount ?? 0,
      sessionCount: definition.sessionCount ?? 0,
      activeSubagentCount: definition.activeSubagentCount ?? 0,
      skillMode: definition.id === "main" ? "all" : "whitelist",
      effectiveSkills:
        definition.id === "main"
          ? ["github", "shell", "frontend-design", "playwright"]
          : ["github", "shell"],
      totalAvailableSkills: 10,
      subagents: {
        allowAgents: definition.id === "ops" ? ["*"] : ["builder", "reviewer", "qa"],
        model: definition.id === "reviewer" ? "openai/gpt-5.4-mini" : undefined,
        effectiveMaxSpawnDepth: definition.id === "main" ? 2 : 1,
        effectiveMaxChildrenPerAgent: definition.id === "main" ? 8 : 5,
      },
      identityExists: true,
      fallbackModels: definition.fallbackModels,
      effectiveSources: {
        workspace: "agent",
        model: "agent",
        skills: definition.id === "main" ? "default" : "agent",
        subagents: definition.id === "ops" ? "agent" : "default",
        eventStreams: definition.id === "ops" ? "agent" : "default",
      },
      inherited: {
        workspace: { source: "agent", hasOverride: true, canReset: true },
        thinkingDefault: { source: "default", hasOverride: false, canReset: false },
        subagentsAllowAgents: {
          source: definition.id === "ops" ? "agent" : "default",
          hasOverride: definition.id === "ops",
          canReset: definition.id === "ops",
        },
        subagentsRequireAgentId: { source: "default", hasOverride: false, canReset: false },
      },
      unresolvedReferences:
        definition.id === "main"
          ? {
              skills: [{ key: "legacy-browser", reason: "disabled" }],
              subagents: [{ agentId: "archived-agent", reason: "agent-not-found" }],
              eventStreams: [{ eventStream: "enterprise.audit.custom", reason: "unknown" }],
              models: [{ model: "openai/gpt-4-legacy", reason: "not-in-catalog" }],
            }
          : undefined,
      impact: agentImpact(definition),
      guardedEdits: [
        {
          field: "workspace",
          risk: definition.id === "main" ? "high" : "medium",
          reason:
            definition.id === "main"
              ? "Changing main workspace affects the protected fallback agent."
              : "Changing workspace affects future runs and workspace files.",
          requiresConfirmation: true,
        },
        {
          field: "model",
          risk: "medium",
          reason: "Changing model affects runtime behavior for future sessions.",
          requiresConfirmation: true,
        },
        {
          field: "eventStreams",
          risk: "medium",
          reason: "Changing streams affects channel delivery and activity visibility.",
          requiresConfirmation: true,
        },
      ],
      ...agentProtection(definition.id),
    };
  };
  const configuredModelChoices = () =>
    Object.entries(configFixture.models?.providers ?? {}).flatMap(([provider, definition]) =>
      (definition.models ?? []).map((model) => ({
        ref: `${provider}/${model.id}`,
        provider,
        model: model.id,
        name: model.name ?? model.id,
      })),
    );
  const resolveModelRef = (value) => {
    if (!value) {
      return "";
    }
    if (String(value).includes("/")) {
      return String(value);
    }
    return String(value).startsWith("sonnet") || String(value).startsWith("claude")
      ? `anthropic/${value}`
      : `openai/${value}`;
  };
  const normalizeModelSelection = (value) => {
    if (!value) {
      return undefined;
    }
    if (typeof value === "string") {
      return { primary: resolveModelRef(value), fallbacks: [] };
    }
    const primary = resolveModelRef(value.primary ?? "");
    const fallbacks = (value.fallbacks ?? []).map(resolveModelRef).filter(Boolean);
    return primary || fallbacks.length > 0 ? { primary, fallbacks } : undefined;
  };
  const modelUnavailableRefs = (selection, choices = configuredModelChoices()) => {
    const configuredRefs = new Set(choices.map((choice) => choice.ref));
    return [selection?.primary, ...(selection?.fallbacks ?? [])]
      .filter(Boolean)
      .filter((ref) => !configuredRefs.has(ref));
  };
  const agentConfigEntry = (agentId) =>
    configFixture.agents?.list?.find((agent) => agent.id === agentId) ?? null;
  const agentPolicySelection = (agentId, key) => {
    const agentConfig = agentConfigEntry(agentId);
    if (key === "agentSubagents") {
      return normalizeModelSelection(agentConfig?.subagents?.model);
    }
    const explicit = normalizeModelSelection(agentConfig?.model);
    if (explicit) {
      return explicit;
    }
    const definition = agentDefinitions[agentId];
    if (!definition || agentId === "main") {
      return undefined;
    }
    return {
      primary: resolveModelRef(definition.model),
      fallbacks: (definition.fallbackModels ?? []).map(resolveModelRef),
    };
  };
  const setAgentPolicySelection = (agentId, key, selection, clear) => {
    let agentConfig = agentConfigEntry(agentId);
    if (!agentConfig) {
      agentConfig = { id: agentId };
      configFixture.agents.list.push(agentConfig);
    }
    if (key === "agentSubagents") {
      agentConfig.subagents ??= {};
      if (clear) {
        delete agentConfig.subagents.model;
        return;
      }
      agentConfig.subagents.model = selection;
      return;
    }
    if (clear) {
      delete agentConfig.model;
      return;
    }
    agentConfig.model = selection;
    const definition = agentDefinitions[agentId];
    if (definition) {
      definition.model = selection.primary?.split("/").pop() ?? definition.model;
      definition.fallbackModels = (selection.fallbacks ?? []).map((ref) => ref.split("/").pop());
    }
  };
  const globalModelPolicyTargets = [
    ["text", "Text default", "agents.defaults.model", "agentModelConfig"],
    ["image", "Image input default", "agents.defaults.imageModel", "agentModelConfig"],
    [
      "imageGeneration",
      "Image generation default",
      "agents.defaults.imageGenerationModel",
      "agentModelConfig",
    ],
    [
      "videoGeneration",
      "Video generation default",
      "agents.defaults.videoGenerationModel",
      "agentModelConfig",
    ],
    [
      "musicGeneration",
      "Music generation default",
      "agents.defaults.musicGenerationModel",
      "agentModelConfig",
    ],
    ["pdf", "PDF default", "agents.defaults.pdfModel", "agentModelConfig"],
    ["compaction", "Compaction default", "agents.defaults.compaction.model", "string"],
    ["memorySearch", "Memory search default", "agents.defaults.memorySearch.model", "string"],
    ["subagents", "Subagent default", "agents.defaults.subagents.model", "agentModelConfig"],
  ];
  const readGlobalModelSelection = (key) => {
    const defaults = configFixture.agents?.defaults ?? {};
    switch (key) {
      case "text":
        return normalizeModelSelection(defaults.model);
      case "image":
        return normalizeModelSelection(defaults.imageModel);
      case "imageGeneration":
        return normalizeModelSelection(defaults.imageGenerationModel);
      case "videoGeneration":
        return normalizeModelSelection(defaults.videoGenerationModel);
      case "musicGeneration":
        return normalizeModelSelection(defaults.musicGenerationModel);
      case "pdf":
        return normalizeModelSelection(defaults.pdfModel);
      case "compaction":
        return normalizeModelSelection(defaults.compaction?.model);
      case "memorySearch":
        return normalizeModelSelection(defaults.memorySearch?.model);
      case "subagents":
        return normalizeModelSelection(defaults.subagents?.model);
      default:
        return undefined;
    }
  };
  const writeGlobalModelSelection = (key, selection) => {
    configFixture.agents.defaults ??= {};
    const defaults = configFixture.agents.defaults;
    switch (key) {
      case "text":
        defaults.model = selection;
        break;
      case "image":
        defaults.imageModel = selection;
        break;
      case "imageGeneration":
        defaults.imageGenerationModel = selection;
        break;
      case "videoGeneration":
        defaults.videoGenerationModel = selection;
        break;
      case "musicGeneration":
        defaults.musicGenerationModel = selection;
        break;
      case "pdf":
        defaults.pdfModel = selection;
        break;
      case "compaction":
        defaults.compaction ??= {};
        defaults.compaction.model = selection.primary ?? "";
        break;
      case "memorySearch":
        defaults.memorySearch ??= {};
        defaults.memorySearch.model = selection.primary ?? "";
        break;
      case "subagents":
        defaults.subagents ??= {};
        defaults.subagents.model = selection;
        break;
      default:
        throw new Error(`unsupported global model policy target: ${key}`);
    }
  };
  const modelPolicyEntry = ({
    agentId,
    configPath,
    effective,
    kind,
    key,
    label,
    selection,
    shape,
    source,
  }) => ({
    kind,
    key,
    label,
    configPath,
    source,
    supportedShape: shape,
    selection,
    effective,
    unavailableRefs: modelUnavailableRefs(selection ?? effective),
    editable: true,
    owner: "agents",
    ...(agentId ? { agentId } : {}),
  });
  const modelPolicyGet = (params) => {
    const agentId = params?.agentId ?? "main";
    const choices = configuredModelChoices();
    const textDefault = readGlobalModelSelection("text");
    const subagentDefault = readGlobalModelSelection("subagents");
    const policies = [
      modelPolicyEntry({
        agentId,
        kind: "agent-model",
        key: "agent",
        label: "Agent runtime model",
        configPath: `agents.list[${agentId}].model`,
        shape: "agentModelConfig",
        source: agentPolicySelection(agentId, "agent") ? "agent" : "default",
        selection: agentPolicySelection(agentId, "agent"),
        effective: agentPolicySelection(agentId, "agent") ?? textDefault,
      }),
      modelPolicyEntry({
        agentId,
        kind: "agent-subagents",
        key: "agentSubagents",
        label: "Agent subagent model",
        configPath: `agents.list[${agentId}].subagents.model`,
        shape: "agentModelConfig",
        source: agentPolicySelection(agentId, "agentSubagents") ? "agent" : "default",
        selection: agentPolicySelection(agentId, "agentSubagents"),
        effective: agentPolicySelection(agentId, "agentSubagents") ?? subagentDefault,
      }),
      ...globalModelPolicyTargets.map(([key, label, configPath, shape]) => {
        const selection = readGlobalModelSelection(key);
        return modelPolicyEntry({
          kind: "global-default",
          key,
          label,
          configPath,
          shape,
          source: selection ? "default" : "missing",
          selection,
          effective: selection,
        });
      }),
    ];
    return {
      agentId,
      configHash: configHash(),
      configuredModels: choices,
      policies: policies.map((policy) => ({
        ...policy,
        unavailableRefs: modelUnavailableRefs(policy.selection ?? policy.effective, choices),
      })),
      unsupported: configFixture.agents?.defaults?.summaryModel
        ? [
            {
              key: "summaryModel",
              configPath: "agents.defaults.summaryModel",
              reason: "Not present in current OpenClaw AgentDefaultsConfig schema",
            },
          ]
        : [],
    };
  };
  const modelPolicySet = (params) => {
    if (params?.baseHash && params.baseHash !== configHash()) {
      throw new Error("stale config base hash");
    }
    const target = params?.target ?? {};
    const selection = normalizeModelSelection(params?.selection);
    if (!params?.clear && !selection?.primary) {
      throw new Error("model policy selection primary is required");
    }
    const isStringTarget =
      target.kind === "global-default" && ["compaction", "memorySearch"].includes(target.key);
    if (isStringTarget && (selection?.fallbacks ?? []).length > 0) {
      throw new Error("string-only model policy target does not support fallbacks");
    }
    if (target.kind === "global-default") {
      writeGlobalModelSelection(target.key, selection ?? {});
    } else if (target.kind === "agent-model") {
      setAgentPolicySelection(target.agentId ?? "main", "agent", selection ?? {}, params?.clear);
    } else if (target.kind === "agent-subagents") {
      setAgentPolicySelection(
        target.agentId ?? "main",
        "agentSubagents",
        selection ?? {},
        params?.clear,
      );
    } else {
      throw new Error(`unsupported model policy target: ${target.kind ?? "missing"}`);
    }
    const nextHash = bumpConfigHash();
    return {
      ok: true,
      agentId: target.agentId,
      target,
      configHash: nextHash,
      selection: params?.clear ? undefined : selection,
      cleared: params?.clear === true,
    };
  };
  const visualSkillInventory = (agentId) => [
    { key: "github", name: "GitHub", eligible: true, assigned: agentId !== "qa" },
    { key: "shell", name: "Shell", eligible: true, assigned: true },
    {
      key: "frontend-design",
      name: "Frontend Design",
      eligible: true,
      assigned: agentId === "builder" || agentId === "main",
    },
    { key: "playwright", name: "Playwright", eligible: true, assigned: agentId === "main" },
    { key: "docs", name: "Docs Search", eligible: true, assigned: agentId === "research" },
    { key: "memory", name: "Memory", eligible: true, assigned: agentId === "ops" },
    { key: "security", name: "Security Review", eligible: true, assigned: agentId === "reviewer" },
    { key: "notion", name: "Notion Capture", eligible: true, assigned: false },
    { key: "gpu-server", name: "GPU Server Ops", eligible: true, assigned: false },
    {
      key: "legacy-browser",
      name: "Legacy Browser Automation",
      eligible: false,
      assigned: false,
    },
  ];
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
        "gateway.batch": {
          scope: "operator.read",
          since: 3,
          params: {
            type: "object",
            required: ["calls"],
            properties: {
              calls: { type: "array" },
              options: { type: "object" },
            },
          },
          result: {
            type: "object",
            required: ["results"],
            properties: {
              results: { type: "array" },
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
    "gateway.batch": (params) => {
      const calls = Array.isArray(params?.calls) ? params.calls : [];
      return {
        results: calls.map((call, index) => {
          const id = typeof call?.id === "string" && call.id ? call.id : `call-${index + 1}`;
          if (call?.method === "gateway.describe") {
            return {
              id,
              ok: true,
              result: {
                events: {
                  "activity.event": { since: 1 },
                  "gateway.ready": { since: 1 },
                },
                methods: {
                  "gateway.batch": { scope: "operator.read", since: 3 },
                  "gateway.describe": { scope: "operator.read", since: 1 },
                },
                protocol: protocolVersion,
                untyped: ["legacy.raw"],
              },
            };
          }
          return {
            id,
            ok: false,
            error: {
              code: "method_not_found",
              message: `mock gateway.batch does not implement child method: ${call?.method ?? ""}`,
            },
          };
        }),
      };
    },
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
        enabled: true,
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
    "agent.identity.get": (params) => ({
      agentId: params?.agentId ?? "main",
      name: params?.agentId === "main" || !params?.agentId ? "Main" : String(params.agentId),
      emoji: params?.agentId === "main" || !params?.agentId ? "M" : undefined,
    }),
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
      const lines = cursor >= logCursor ? [] : logLines.slice(-limit);
      return {
        cursor: logCursor,
        file: "/tmp/openclaw/logs/mock.log",
        lines,
        reset: false,
        size: lines.join("\n").length,
        truncated: false,
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
      agents: agentDefinitionList().map(agentSummary),
      defaultId: defaultAgentId,
      mainKey,
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
      if (path === "agents" || path === "agents.defaults") {
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
    "config.patch": (params) => {
      if (typeof params?.raw === "string") {
        try {
          configFixture = JSON.parse(params.raw);
        } catch {
          // Keep the last fixture if a caller submits malformed JSON.
        }
      }
      return {
        ok: true,
        baseHash: params?.baseHash ?? configHash(),
        hash: bumpConfigHash(),
        raw: JSON.stringify(configFixture, null, 2),
      };
    },
    "deck.routing.list": () => ({
      bindings: [
        {
          id: "7c61b9d2ea11",
          agentId: "ops",
          tier: "peer",
          comment: "Direct finance escalation — high-priority peer route",
          match: {
            channel: "discord",
            accountId: "enterprise",
            peer: { kind: "direct", id: "finance-lead" },
          },
        },
        {
          id: "4c892e17af32",
          agentId: "security",
          tier: "guild+roles",
          comment: "Subset of Discord prod admins, falls through to channel route",
          match: {
            channel: "discord",
            accountId: "enterprise",
            guildId: "openclaw-prod",
            roles: ["admin", "ops"],
          },
        },
        {
          id: "9a3f02bc1d77",
          agentId: "support",
          tier: "peer",
          comment: "WeCom support group — office hours",
          match: {
            channel: "wecom",
            accountId: "default",
            peer: { kind: "group", id: "group-913" },
          },
        },
        {
          id: "b8e5f7c910ab",
          agentId: "support",
          tier: "team",
          comment: "Slack workspace-wide support fallback",
          match: {
            channel: "slack",
            accountId: "openclaw",
            teamId: "T01ABC",
          },
        },
        {
          id: "3d2c6a90fe48",
          agentId: "ops",
          tier: "guild",
          comment: "Prod guild fallback — caught by ops if no role match",
          match: {
            channel: "discord",
            accountId: "enterprise",
            guildId: "openclaw-prod",
          },
        },
        {
          id: "5e1b8d33a112",
          agentId: "marketing",
          tier: "peer",
          comment: "Marketing channel announcements",
          match: {
            channel: "telegram",
            accountId: "ops-bot",
            peer: { kind: "channel", id: "telegram-marketing" },
          },
        },
        {
          id: "f7a04c61b2d9",
          agentId: "main",
          tier: "channel",
          comment: "Broad Discord enterprise fallback",
          match: {
            channel: "discord",
            accountId: "enterprise",
          },
        },
        {
          id: "c0441afda1c8",
          agentId: "main",
          tier: "channel",
          comment: "Broad WeCom fallback",
          match: {
            channel: "wecom",
            accountId: "default",
          },
        },
      ],
      defaultAgentId: "main",
      dmScope: "per-channel-peer",
      configHash: "9af31c2d80ab",
    }),
    "deck.agents.subagents.get": (params) => ({
      agentId: params?.agentId ?? "main",
      allowAgents:
        params?.agentId === "ops"
          ? ["*"]
          : params?.agentId === "main"
            ? ["builder", "reviewer", "qa"]
            : params?.agentId === "builder"
              ? ["reviewer", "qa"]
              : [],
      allowAny: params?.agentId === "ops",
      allAgents: agentDefinitionList().map((agent) => ({ id: agent.id, name: agent.name })),
      configHash: `${params?.agentId ?? "main"}-subagents-hash`,
      effectiveMaxChildrenPerAgent: params?.agentId === "main" ? 8 : 5,
      effectiveMaxSpawnDepth: params?.agentId === "main" ? 2 : 1,
      model: params?.agentId === "reviewer" ? "openai/gpt-5.4-mini" : undefined,
      requireAgentId: params?.agentId === "main",
    }),
    "deck.agents.subagents.set": (params) => ({
      ok: true,
      agentId: params?.agentId ?? "main",
      allowAgents: params?.allowAgents ?? [],
      configHash: `${params?.baseHash ?? "subagents-hash"}-saved`,
      model: params?.model,
      requireAgentId: params?.requireAgentId,
    }),
    "deck.agents.modelPolicy.get": (params) => modelPolicyGet(params),
    "deck.agents.modelPolicy.set": (params) => modelPolicySet(params),
    "deck.agents.impactPreview.get": (params) => {
      const definition = agentDefinitions[params?.agentId ?? "main"] ?? agentDefinitions.main;
      const operation = params?.operation ?? "delete-agent";
      const impact = agentImpact(definition, operation);
      return {
        agentId: definition.id,
        operation,
        impact,
        riskSpecifics: [
          `${impact.bindingCount ?? 0} routing bindings reference ${definition.id}`,
          `${impact.sessionCount ?? 0} sessions may keep historical references`,
        ],
        canProceedWithoutImpact: false,
        baseHash: params?.baseHash,
      };
    },
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
      const requestedRunId = params?.runId;
      const requestedSessionKey = params?.sessionKey;
      const selectedRun =
        subagentRuns.find((run) => run.runId === requestedRunId) ??
        subagentRuns.find((run) => run.childSessionKey === requestedSessionKey) ??
        subagentRuns[0];
      return {
        root: {
          sessionKey: "agent:main:main",
          agentId: "main",
          agentName: "Main",
        },
        nodes: subagentLineageNodes.map((node) =>
          node.runId === selectedRun.runId ? { ...node, status: selectedRun.status } : node,
        ),
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
        threads = threads.filter(
          (thread) => thread.channelId === channel || thread.channelId.split(":")[0] === channel,
        );
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
    "deck.agents.detail": (params) => agentDetail(params?.agentId ?? "main"),
    "skills.status": () => ({
      managedSkillsDir: "/tmp/openclaw-skills",
      workspaceDir: "/tmp/openclaw-main",
      skills: [
        {
          skillKey: "github",
          name: "GitHub",
          source: "openclaw-managed",
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
          source: "openclaw-bundled",
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
          source: "openclaw-managed",
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
          skillKey: "writing-plans",
          name: "Writing Plans",
          source: "openclaw-workspace",
          description: "Plan multi-step work with explicit verification gates.",
          primaryEnv: "",
          disabled: false,
          eligible: true,
          install: [],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "test-driven-development",
          name: "Test-Driven Development",
          source: "openclaw-extra",
          description: "Red, green, refactor discipline for feature work.",
          primaryEnv: "",
          disabled: false,
          eligible: true,
          config: { strictRedGreen: true },
          install: [],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "systematic-debugging",
          name: "Systematic Debugging",
          source: "agents-skills-personal",
          description: "Hypothesis-driven debugging with evidence checkpoints.",
          primaryEnv: "",
          disabled: false,
          eligible: true,
          install: [],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "openspec-propose",
          name: "OpenSpec Propose",
          source: "agents-skills-project",
          description: "Create proposal, design, spec delta, and task artifacts.",
          primaryEnv: "",
          disabled: false,
          eligible: true,
          config: { defaultSchema: "spec-driven" },
          install: [{ id: "managed", kind: "download", label: "Hub managed", bins: ["openspec"] }],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "ppp-generation",
          name: "PPP Generation",
          source: "openclaw-managed",
          description: "Generate industrial-grade 3D printing production plans.",
          primaryEnv: "PPP_KNOWLEDGE_BASE",
          disabled: false,
          eligible: false,
          config: {},
          install: [{ id: "managed", kind: "download", label: "Hub managed", bins: ["ppp"] }],
          missing: {
            env: ["PPP_KNOWLEDGE_BASE"],
            bins: ["gpt-researcher"],
            config: [],
            anyBins: [],
            os: [],
          },
        },
        {
          skillKey: "qa-testing-playwright",
          name: "QA Testing Playwright",
          source: "openclaw-managed",
          description: "Run selector-aware Playwright checks and visual tests.",
          primaryEnv: "PLAYWRIGHT_BROWSERS_PATH",
          disabled: false,
          eligible: true,
          install: [
            { id: "managed", kind: "download", label: "Hub managed", bins: ["playwright"] },
          ],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "domain-research",
          name: "Domain Research",
          source: "openclaw-managed",
          description: "Deep research workflow that writes structured notes.",
          primaryEnv: "OBSIDIAN_VAULT_PATH",
          disabled: false,
          eligible: false,
          install: [{ id: "managed", kind: "download", label: "Hub managed", bins: ["research"] }],
          missing: {
            env: ["OBSIDIAN_VAULT_PATH"],
            bins: [],
            config: [],
            anyBins: [],
            os: [],
          },
        },
        {
          skillKey: "obsidian-markdown",
          name: "Obsidian Markdown",
          source: "third-party-plugin",
          description: "Author Obsidian markdown with wikilinks and callouts.",
          primaryEnv: "",
          disabled: false,
          eligible: true,
          install: [],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "gpu-server-ops",
          name: "GPU Server Ops",
          source: "openclaw-managed",
          description: "Operate remote GPU model hosts and services.",
          primaryEnv: "GPU_SERVER_HOST",
          disabled: true,
          eligible: true,
          config: { server: "100.84.132.54" },
          install: [{ id: "managed", kind: "download", label: "Hub managed", bins: [] }],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "self-improve",
          name: "Self Improve",
          source: "openclaw-bundled",
          description: "Autonomous code improvement loop with tournament selection.",
          primaryEnv: "",
          disabled: false,
          eligible: true,
          config: { populationSize: 8 },
          install: [],
          missing: { env: [], bins: [], config: [], anyBins: [], os: [] },
        },
        {
          skillKey: "legacy-browser",
          name: "Legacy Browser",
          source: "legacy-plugin",
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
        {
          slug: "release-orchestrator",
          displayName: "Release Orchestrator",
          summary: "Drive version bumps, changelog notes, dry-run publish, and tag flows.",
          version: "1.4.0",
          score: 0.94,
          updatedAt: now - 72 * 60 * 60 * 1_000,
        },
        {
          slug: "git-worktree-master",
          displayName: "Git Worktree Master",
          summary: "Manage isolated worktrees for parallel feature delivery.",
          version: "0.9.0",
          score: 0.88,
          updatedAt: now - 5 * 24 * 60 * 60 * 1_000,
        },
        {
          slug: "knowledge-vault",
          displayName: "Knowledge Vault",
          summary: "Search, organize, and maintain an Obsidian knowledge vault.",
          version: "0.3.0",
          score: 0.74,
          updatedAt: now - 14 * 24 * 60 * 60 * 1_000,
        },
        {
          slug: "deep-interview",
          displayName: "Deep Interview",
          summary: "Socratic interview flow with ambiguity gating.",
          version: "0.7.0",
          score: 0.69,
          updatedAt: now - 30 * 24 * 60 * 60 * 1_000,
        },
        {
          slug: "trace-causal",
          displayName: "Trace Causal",
          summary: "Evidence-driven causal investigation with competing hypotheses.",
          version: "0.5.0",
          score: 0.55,
          updatedAt: now - 41 * 24 * 60 * 60 * 1_000,
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
      const available = visualSkillInventory(agentId);
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
    "deck.agents.eventStreams.get": (params) => ({
      agentId: params?.agentId ?? "main",
      eventStreams:
        params?.agentId === "ops"
          ? ["agent.status.changed", "session.message", "enterprise.audit.custom"]
          : ["agent.status.changed", "activity.event"],
      isDefault: params?.agentId === defaultAgentId,
      configHash: `event-streams-${params?.agentId ?? "main"}-1`,
    }),
    "deck.agents.eventStreams.set": (params) => ({
      ok: true,
      agentId: params?.agentId ?? "main",
      eventStreams: params?.eventStreams ?? [],
      configHash: `${params?.baseHash ?? "event-streams-hash"}-saved`,
    }),
    "deck.agents.toolPolicy.preview": (params) => ({
      agentId: params?.agentId ?? "main",
      layers: [
        { label: "Global tools", ruleCount: 4, effect: "allow" },
        {
          label: "Agent override",
          ruleCount: params?.agentId === "ops" ? 2 : 0,
          effect: "mixed",
        },
      ],
      tools: [
        {
          name: "shell.exec",
          allowed: params?.agentId !== "research",
          decisiveLayer: "Global tools",
        },
        { name: "browser.open", allowed: true, decisiveLayer: "Agent override" },
        { name: "git.push", allowed: false, decisiveLayer: "Global tools" },
      ],
    }),
    "deck.agents.systemPrompt.preview": (params) => ({
      agentId: params?.agentId ?? "main",
      totalChars: 3284,
      layers: [
        { label: "System", source: "openclaw", charCount: 860, fileCount: 0 },
        { label: "Agent", source: "agents.systemPrompt", charCount: 1220, fileCount: 1 },
        { label: "Workspace", source: "workspace files", charCount: 1204, fileCount: 2 },
      ],
      bootstrapFiles: [
        { name: "AGENTS.md", exists: true, charCount: 820 },
        { name: "MEMORY.md", exists: true, charCount: 384 },
        { name: "TOOLS.md", exists: false, charCount: 0 },
      ],
    }),
    "usage.cost": (params) => {
      const daily = [
        {
          date: "2026-04-21",
          input: 282_000,
          output: 94_000,
          cacheRead: 42_000,
          cacheWrite: 8_000,
          totalTokens: 426_000,
          totalCost: 12.84,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-22",
          input: 301_000,
          output: 102_000,
          cacheRead: 46_000,
          cacheWrite: 7_000,
          totalTokens: 456_000,
          totalCost: 14.01,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-23",
          input: 352_000,
          output: 121_000,
          cacheRead: 54_000,
          cacheWrite: 9_000,
          totalTokens: 536_000,
          totalCost: 17.55,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-24",
          input: 381_000,
          output: 128_000,
          cacheRead: 61_000,
          cacheWrite: 11_000,
          totalTokens: 581_000,
          totalCost: 19.04,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-25",
          input: 420_000,
          output: 144_000,
          cacheRead: 72_000,
          cacheWrite: 12_000,
          totalTokens: 648_000,
          totalCost: 22.91,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-26",
          input: 152_000,
          output: 48_000,
          cacheRead: 28_000,
          cacheWrite: 4_000,
          totalTokens: 232_000,
          totalCost: 8.76,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-27",
          input: 130_000,
          output: 41_000,
          cacheRead: 22_000,
          cacheWrite: 3_000,
          totalTokens: 196_000,
          totalCost: 7.42,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-28",
          input: 324_000,
          output: 108_000,
          cacheRead: 52_000,
          cacheWrite: 10_000,
          totalTokens: 494_000,
          totalCost: 16.2,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-29",
          input: 440_000,
          output: 150_000,
          cacheRead: 88_000,
          cacheWrite: 13_000,
          totalTokens: 691_000,
          totalCost: 23.55,
          missingCostEntries: 0,
        },
        {
          date: "2026-04-30",
          input: 512_000,
          output: 171_000,
          cacheRead: 94_000,
          cacheWrite: 18_000,
          totalTokens: 795_000,
          totalCost: 28.12,
          missingCostEntries: 0,
        },
        {
          date: "2026-05-01",
          input: 566_000,
          output: 182_000,
          cacheRead: 101_000,
          cacheWrite: 20_000,
          totalTokens: 869_000,
          totalCost: 31.04,
          missingCostEntries: 0,
        },
        {
          date: "2026-05-02",
          input: 620_000,
          output: 204_000,
          cacheRead: 118_000,
          cacheWrite: 24_000,
          totalTokens: 966_000,
          totalCost: 34.78,
          missingCostEntries: 0,
        },
        {
          date: "2026-05-03",
          input: 540_000,
          output: 188_000,
          cacheRead: 96_000,
          cacheWrite: 18_000,
          totalTokens: 842_000,
          totalCost: 29.66,
          missingCostEntries: 0,
        },
        {
          date: "2026-05-04",
          input: 455_000,
          output: 150_000,
          cacheRead: 88_000,
          cacheWrite: 14_000,
          totalTokens: 707_000,
          totalCost: 24.18,
          missingCostEntries: 0,
        },
      ];
      const days = Number(params?.days ?? 14);
      const windowed = daily.slice(-Math.min(Math.max(days, 1), daily.length));
      return {
        updatedAt: Date.now(),
        days,
        daily: windowed,
        totals: windowed.reduce(
          (totals, entry) => ({
            input: totals.input + entry.input,
            output: totals.output + entry.output,
            cacheRead: totals.cacheRead + entry.cacheRead,
            cacheWrite: totals.cacheWrite + entry.cacheWrite,
            totalTokens: totals.totalTokens + entry.totalTokens,
            totalCost: Number((totals.totalCost + entry.totalCost).toFixed(2)),
            missingCostEntries: 0,
          }),
          {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            totalCost: 0,
            missingCostEntries: 0,
          },
        ),
      };
    },
    "usage.status": () => ({
      updatedAt: Date.now(),
      providers: [
        {
          provider: "anthropic",
          displayName: "Anthropic",
          plan: "Team annual",
          windows: [
            { label: "5h Sonnet", usedPercent: 92, resetAt: now + 30 * 60 * 1_000 },
            { label: "5h Opus", usedPercent: 41, resetAt: now + 30 * 60 * 1_000 },
            { label: "Weekly Sonnet", usedPercent: 67, resetAt: now + 4 * 24 * 60 * 60 * 1_000 },
            { label: "Weekly Opus", usedPercent: 28, resetAt: now + 4 * 24 * 60 * 60 * 1_000 },
          ],
        },
        {
          provider: "openai",
          displayName: "OpenAI",
          plan: "Pay-as-you-go",
          windows: [
            { label: "5h GPT-5.5", usedPercent: 14, resetAt: now + 40 * 60 * 1_000 },
            { label: "Daily GPT-5.5", usedPercent: 38, resetAt: now + 14 * 60 * 60 * 1_000 },
          ],
        },
        {
          provider: "google",
          displayName: "Google AI",
          plan: "Free tier",
          error: "quota.unknown — last sync failed at 14:02",
          windows: [
            { label: "Daily Gemini 2.5", usedPercent: 0, resetAt: now + 18 * 60 * 60 * 1_000 },
          ],
        },
        {
          provider: "local",
          displayName: "Local fallback",
          plan: "self-hosted",
          windows: [{ label: "Concurrent slots", usedPercent: 56 }],
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
          updatedAt: now - 4 * 60_000,
          agentId: "main",
          channel: "cli",
          usage: { input: 1_245_891, output: 812_440, totalTokens: 2_058_331, totalCost: 18.42 },
          contextWeight,
        },
        {
          key: "agent:builder:web-root",
          label: "Builder validation",
          sessionId: "agent:builder:web-root",
          updatedAt: now - 22 * 60_000,
          agentId: "builder",
          channel: "web",
          usage: { input: 412_104, output: 184_009, totalTokens: 596_113, totalCost: 4.18 },
          contextWeight,
        },
        {
          key: "agent:ops:discord-triage",
          label: "Ops channel triage",
          sessionId: "agent:ops:discord-triage",
          updatedAt: now - 60 * 60_000,
          agentId: "ops",
          channel: "discord",
          usage: { input: 88_240, output: 41_080, totalTokens: 129_320, totalCost: 0.61 },
        },
        {
          key: "session:review-pool:batch",
          label: "Review pool batch",
          sessionId: "session:review-pool:batch",
          updatedAt: now - 3 * 60 * 60_000,
          agentId: "reviewer",
          channel: "cli",
          usage: { input: 218_000, output: 102_400, totalTokens: 320_400, totalCost: 1.84 },
        },
        {
          key: "session:discord:spec-writing",
          label: "Main spec writing",
          sessionId: "session:discord:spec-writing",
          updatedAt: now - 8 * 60 * 60_000,
          agentId: "main",
          channel: "discord",
          usage: { input: 612_400, output: 308_104, totalTokens: 920_504, totalCost: 6.42 },
        },
        {
          key: "session:system:housekeeping",
          label: "System housekeeping",
          sessionId: "session:system:housekeeping",
          updatedAt: now - 12 * 60 * 60_000,
          agentId: "system",
          channel: "cli",
          usage: { input: 4_120, output: 980, totalTokens: 5_100, totalCost: 0.02 },
        },
        {
          key: "session:wecom:subagents",
          label: "Daisy bugfix subagents",
          sessionId: "session:wecom:subagents",
          updatedAt: now - 18 * 60 * 60_000,
          agentId: "main",
          channel: "wecom",
          usage: { input: 188_410, output: 96_300, totalTokens: 284_710, totalCost: 1.42 },
        },
        {
          key: "session:email:smoke-test",
          label: "Team Builder smoke test",
          sessionId: "session:email:smoke-test",
          updatedAt: now - 26 * 60 * 60_000,
          agentId: "builder",
          channel: "email",
          usage: null,
          contextWeight: null,
        },
      ];
      const selectedSessions = params?.key
        ? usageSessions.filter((entry) => entry.key === key)
        : usageSessions;
      return {
        updatedAt: Date.now(),
        startDate: "2026-04-28",
        endDate: "2026-05-04",
        totals: {
          input: 2_769_165,
          output: 1_545_313,
          cacheRead: 412_004,
          cacheWrite: 88_312,
          totalTokens: 4_814_794,
          totalCost: 32.91,
        },
        aggregates: {
          byAgent: [
            { agentId: "main", totals: { totalTokens: 3_263_545, totalCost: 26.26 } },
            { agentId: "builder", totals: { totalTokens: 596_113, totalCost: 4.18 } },
            { agentId: "reviewer", totals: { totalTokens: 320_400, totalCost: 1.84 } },
            { agentId: "ops", totals: { totalTokens: 129_320, totalCost: 0.61 } },
            { agentId: "system", totals: { totalTokens: 5_100, totalCost: 0.02 } },
          ],
          byChannel: [
            { channel: "cli", totals: { totalTokens: 2_383_831, totalCost: 20.28 } },
            { channel: "web", totals: { totalTokens: 596_113, totalCost: 4.18 } },
            { channel: "discord", totals: { totalTokens: 1_049_824, totalCost: 7.03 } },
            { channel: "wecom", totals: { totalTokens: 284_710, totalCost: 1.42 } },
            { channel: "email", totals: { totalTokens: 0, totalCost: 0 } },
          ],
          byModel: [
            { model: "gpt-5.4", totals: { totalTokens: 1_049_824, totalCost: 7.03 } },
            { model: "gpt-5.4-mini", totals: { totalTokens: 284_710, totalCost: 1.42 } },
            { model: "claude-opus-4-7", totals: { totalTokens: 2_058_331, totalCost: 18.42 } },
            { model: "sonnet-4.6", totals: { totalTokens: 921_613, totalCost: 6.04 } },
          ],
          byProvider: [
            { provider: "openai", totals: { totalTokens: 1_334_534, totalCost: 8.45 } },
            { provider: "anthropic", totals: { totalTokens: 2_979_944, totalCost: 24.46 } },
            { provider: "local", totals: { totalTokens: 5_100, totalCost: 0.02 } },
          ],
          daily: [
            {
              date: "2026-04-28",
              tokens: 494_000,
              cost: 16.2,
              messages: 22,
              toolCalls: 8,
              errors: 0,
            },
            {
              date: "2026-04-29",
              tokens: 691_000,
              cost: 23.55,
              messages: 31,
              toolCalls: 11,
              errors: 0,
            },
            {
              date: "2026-04-30",
              tokens: 795_000,
              cost: 28.12,
              messages: 36,
              toolCalls: 14,
              errors: 1,
            },
            {
              date: "2026-05-01",
              tokens: 869_000,
              cost: 31.04,
              messages: 40,
              toolCalls: 15,
              errors: 0,
            },
            {
              date: "2026-05-02",
              tokens: 966_000,
              cost: 34.78,
              messages: 44,
              toolCalls: 18,
              errors: 1,
            },
            {
              date: "2026-05-03",
              tokens: 842_000,
              cost: 29.66,
              messages: 39,
              toolCalls: 16,
              errors: 0,
            },
            {
              date: "2026-05-04",
              tokens: 707_000,
              cost: 24.18,
              messages: 34,
              toolCalls: 12,
              errors: 0,
            },
          ],
          modelDaily: [
            {
              date: "2026-05-01",
              provider: "anthropic",
              model: "claude-opus-4-7",
              tokens: 2_058_331,
              cost: 18.42,
              count: 1,
            },
            {
              date: "2026-05-02",
              provider: "openai",
              model: "gpt-5.4",
              tokens: 920_504,
              cost: 6.42,
              count: 1,
            },
            {
              date: "2026-05-02",
              provider: "anthropic",
              model: "sonnet-4.6",
              tokens: 916_513,
              cost: 6.02,
              count: 3,
            },
            {
              date: "2026-05-03",
              provider: "openai",
              model: "gpt-5.4-mini",
              tokens: 414_030,
              cost: 2.03,
              count: 2,
            },
          ],
          latency: { count: 246, avgMs: 820, p95Ms: 1_240, minMs: 120, maxMs: 1_900 },
          messages: {
            total: 246,
            user: 96,
            assistant: 107,
            toolCalls: 36,
            toolResults: 6,
            errors: 2,
          },
          tools: {
            totalCalls: 94,
            uniqueTools: 6,
            tools: [
              { name: "search", count: 34 },
              { name: "read_file", count: 25 },
              { name: "write_file", count: 13 },
              { name: "gateway.describe", count: 9 },
              { name: "git_diff", count: 8 },
              { name: "playwright", count: 5 },
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
          timestamp: Date.now() - 48_000,
          role: "system",
          content: "usage log detail",
          tokens: 12,
          cost: 0.01,
        },
        {
          timestamp: Date.now() - 36_000,
          role: "user",
          content: "Review the provider quota pressure and session cost spike.",
          tokens: 28,
          cost: 0.02,
        },
        {
          timestamp: Date.now() - 24_000,
          role: "assistant",
          content: "Identified Anthropic 5h Sonnet as the hottest quota window.",
          tokens: 54,
          cost: 0.04,
        },
        {
          timestamp: Date.now() - 12_000,
          role: "tool_call",
          content: "gateway.describe usage cost and session routes",
          tokens: 18,
          cost: 0.01,
        },
        {
          timestamp: Date.now(),
          role: "tool_result",
          content: "usage routes returned cost, provider, session, log, and timeseries payloads",
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
        {
          timestamp: now + 12_000,
          input: 20_000,
          output: 11_000,
          cacheRead: 3_000,
          cacheWrite: 1_000,
          totalTokens: 35_000,
          cost: 0.62,
          cumulativeTokens: 119_000,
          cumulativeCost: 2.04,
        },
        {
          timestamp: now + 24_000,
          input: 26_000,
          output: 14_000,
          cacheRead: 4_000,
          cacheWrite: 1_000,
          totalTokens: 45_000,
          cost: 0.78,
          cumulativeTokens: 164_000,
          cumulativeCost: 2.82,
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
    "plugin.approval.list": () => [
      {
        id: "plugin-ap-1",
        createdAtMs: Date.now() - 2_000,
        expiresAtMs: Date.now() + 90_000,
        request: {
          pluginId: "wecom",
          title: "connect workspace",
          description: "Allow the plugin to connect a workspace.",
          toolName: "workspace.connect",
        },
      },
    ],
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
