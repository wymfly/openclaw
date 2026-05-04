// data.js — gateway control plane mock fixture.
// Real DTOs: DeckGoGatewayHealthResponse / DeckGoGatewayStatusResponse /
// DeckGoGatewayDescribeResponse / DeckGoGatewayBatch* / DeckGoBootstrapStatusResponse.

const NOW = Date.now();

const HEALTH_RESPONSE = {
  ok: true,
  durationMs: 14,
  agents: [
    { agentId: "main", sessions: { count: 4 } },
    { agentId: "team-builder", sessions: { count: 2 } },
    { agentId: "ops-rotation", sessions: { count: 1 } },
    { agentId: "review-pool", sessions: { count: 0 } },
    { agentId: "system", sessions: { count: 0 } },
  ],
  sessions: { count: 7, path: "/Users/wangym/.openclaw/sessions" },
  channels: {
    cli: { connected: true, lastSeen: NOW - 8_000 },
    telegram: { connected: true, lastSeen: NOW - 12_000 },
    discord: { connected: true, lastSeen: NOW - 1_400 },
    slack: { connected: false, lastSeen: NOW - 480_000 },
    wecom: { connected: true, lastSeen: NOW - 600 },
    email: { connected: false, lastSeen: NOW - 3_600_000 },
  },
  channelLabels: {
    cli: "CLI",
    telegram: "Telegram",
    discord: "Discord",
    slack: "Slack",
    wecom: "WeCom",
    email: "Email",
  },
  channelOrder: ["cli", "telegram", "discord", "slack", "wecom", "email"],
  defaultAgentId: "main",
  heartbeatSeconds: 30,
  ts: NOW,
};

const STATUS_RESPONSE = {
  state: "running",
  channelSummary: [
    "cli: 1 session",
    "telegram: 3 sessions",
    "discord: 2 sessions",
    "wecom: 1 session",
    "slack: disconnected",
    "email: disconnected",
  ],
  heartbeat: {
    agents: [
      { agentId: "main", enabled: true, every: "30s", everyMs: 30_000 },
      { agentId: "team-builder", enabled: true, every: "60s", everyMs: 60_000 },
      { agentId: "ops-rotation", enabled: true, every: "30s", everyMs: 30_000 },
      { agentId: "review-pool", enabled: false, every: "5m", everyMs: 300_000 },
      { agentId: "system", enabled: true, every: "5m", everyMs: 300_000 },
    ],
    defaultAgentId: "main",
  },
  linkChannel: { authAgeMs: 320_000, id: "discord", label: "Discord", linked: true },
  queuedSystemEvents: ["session.start", "subagent.spawn", "tool.call", "alert.fire"],
  runtimeVersion: "openclaw 0.10.4 (deck-go bundled)",
  sessions: {
    byAgent: [
      { agentId: "main", count: 4 },
      { agentId: "team-builder", count: 2 },
      { agentId: "ops-rotation", count: 1 },
    ],
    count: 7,
    defaults: { contextTokens: 200_000, model: "claude-opus-4-7" },
    paths: ["/Users/wangym/.openclaw/sessions"],
  },
  channels: {
    cli: { connected: true, lastSeen: NOW - 8_000 },
    telegram: { connected: true, lastSeen: NOW - 12_000 },
    discord: { connected: true, lastSeen: NOW - 1_400 },
    slack: { connected: false, lastSeen: NOW - 480_000 },
    wecom: { connected: true, lastSeen: NOW - 600 },
    email: { connected: false, lastSeen: NOW - 3_600_000 },
  },
};

// Describe response — rich method registry covering all 7 scopes.
const DESCRIBE_RESPONSE = {
  methods: {
    // session
    "sessions.list": {
      scope: "operator.read",
      since: 1,
      params: { agentId: "string?" },
      result: { sessions: "Session[]" },
    },
    "sessions.create": {
      scope: "operator.write",
      since: 1,
      params: { agentId: "string", model: "string?" },
      result: { sessionId: "string" },
    },
    "sessions.send": {
      scope: "operator.write",
      since: 1,
      params: { sessionId: "string", message: "string" },
      result: { ok: "boolean" },
    },
    "sessions.cancel": {
      scope: "operator.write",
      since: 1,
      params: { sessionId: "string" },
      result: { ok: "boolean" },
    },
    "sessions.usage": {
      scope: "operator.read",
      since: 1,
      params: { range: "string?" },
      result: "DeckGoUsageSessionsResponse",
    },
    "sessions.usage.logs": {
      scope: "operator.read",
      since: 2,
      params: { sessionKey: "string" },
      result: "DeckGoUsageSessionLogsResponse",
    },
    "sessions.usage.timeseries": {
      scope: "operator.read",
      since: 2,
      params: { sessionKey: "string" },
      result: "DeckGoUsageTimeseriesResponse",
    },
    // agents
    "agents.list": {
      scope: "operator.read",
      since: 1,
      params: {},
      result: { agents: "AgentEntry[]" },
    },
    "agents.detail": {
      scope: "operator.read",
      since: 1,
      params: { agentId: "string" },
      result: "AgentDetail",
    },
    "agents.subagent.config": { scope: "operator.read", since: 3 },
    "agents.subagent.config.set": { scope: "operator.write", since: 3 },
    // subagents
    "subagents.list": { scope: "operator.read", since: 2 },
    "subagents.lineage": { scope: "operator.read", since: 2 },
    "subagents.kill": { scope: "operator.write", since: 2 },
    "subagents.steer": { scope: "operator.write", since: 2 },
    // channels
    "channels.list": { scope: "operator.read", since: 1 },
    "channels.test": { scope: "operator.write", since: 1 },
    "channels.throughput": { scope: "operator.read", since: 1 },
    // models
    "models.list": { scope: "operator.read", since: 1 },
    "models.detail": { scope: "operator.read", since: 1 },
    // usage
    "usage.cost": { scope: "operator.read", since: 1 },
    "usage.status": { scope: "operator.read", since: 1 },
    "usage.budget.list": { scope: "operator.read", since: 4 },
    "usage.budget.evaluate": { scope: "operator.read", since: 4 },
    "usage.budget.upsert": { scope: "operator.write", since: 4 },
    "usage.budget.delete": { scope: "operator.write", since: 4 },
    // identity
    "identity.canonicals": { scope: "operator.read", since: 3 },
    "identity.link": { scope: "operator.write", since: 3 },
    "identity.unlink": { scope: "operator.write", since: 3 },
    "identity.rename": { scope: "operator.write", since: 3 },
    // alerts
    "alerts.list": { scope: "operator.read", since: 4 },
    "alerts.upsert": { scope: "operator.write", since: 4 },
    "alerts.delete": { scope: "operator.write", since: 4 },
    "alerts.test": { scope: "operator.write", since: 4 },
    // gateway
    "gateway.health": { scope: "operator.read", since: 1 },
    "gateway.status": { scope: "operator.read", since: 1 },
    "gateway.describe": { scope: "operator.read", since: 2 },
    "gateway.batch": { scope: "operator.write", since: 4 },
    // bootstrap
    "bootstrap.status": { scope: "operator.read", since: 1 },
    // plugins
    "plugins.list": { scope: "operator.read", since: 2 },
    "plugins.detail": { scope: "operator.read", since: 2 },
    // skills
    "skills.list": { scope: "operator.read", since: 3 },
    "skills.install": { scope: "operator.write", since: 3 },
    "skills.disable": { scope: "operator.write", since: 3 },
    "skills.hub.search": { scope: "operator.read", since: 3 },
    // routing
    "routing.list": { scope: "operator.read", since: 1 },
    "routing.upsert": { scope: "operator.write", since: 1 },
    // approvals
    "approvals.queue": { scope: "operator.read", since: 4 },
    "approvals.grant": { scope: "operator.write", since: 4 },
    "approvals.deny": { scope: "operator.write", since: 4 },
    // cron
    "cron.list": { scope: "operator.read", since: 4 },
    "cron.upsert": { scope: "operator.write", since: 4 },
    // webhooks
    "webhooks.list": { scope: "operator.read", since: 4 },
    "webhooks.test": { scope: "operator.write", since: 4 },
    // memory / docs / nodes
    "memory.list": { scope: "operator.read", since: 4 },
    "docs.search": { scope: "operator.read", since: 4 },
    "nodes.list": { scope: "operator.read", since: 4 },
  },
  events: {
    "session.start": {
      since: 1,
      payload: { sessionId: "string", agentId: "string", channel: "string" },
    },
    "session.end": { since: 1, payload: { sessionId: "string", durationMs: "number" } },
    "session.error": {
      since: 1,
      payload: { sessionId: "string", code: "string", message: "string" },
    },
    "agent.start": { since: 1, payload: { agentId: "string" } },
    "agent.stop": { since: 1, payload: { agentId: "string" } },
    "agent.error": { since: 1, payload: { agentId: "string", message: "string" } },
    "agent.handoff": { since: 2, payload: { from: "string", to: "string", sessionId: "string" } },
    "tool.call": { since: 1, payload: { sessionId: "string", tool: "string" } },
    "tool.result": { since: 1, payload: { sessionId: "string", tool: "string", ok: "boolean" } },
    "tool.deny": { since: 1, payload: { sessionId: "string", tool: "string", reason: "string" } },
    "subagent.spawn": { since: 2, payload: { runId: "string", parent: "string" } },
    "subagent.kill": { since: 2, payload: { runId: "string" } },
    "subagent.steer": { since: 2, payload: { runId: "string", message: "string" } },
    "message.in": { since: 1, payload: { channel: "string", text: "string" } },
    "message.out": { since: 1, payload: { channel: "string", text: "string" } },
    "channel.connect": { since: 1, payload: { channel: "string" } },
    "channel.disconnect": { since: 1, payload: { channel: "string" } },
    "channel.error": { since: 1, payload: { channel: "string", message: "string" } },
    "config.change": { since: 1, payload: { path: "string", from: "any", to: "any" } },
    "alert.fire": { since: 4, payload: { ruleId: "string", entity: "string" } },
    "approval.request": { since: 4, payload: { id: "string", subject: "string" } },
  },
  untyped: ["internal.diag.dump", "internal.diag.flush"],
};

// Recent batch invocations — rolling window of 8 batches used in the
// batch-console tab + Recent activity card.
const RECENT_BATCHES = [
  {
    id: "batch_2a91",
    runtimeId: "rt_eba210",
    requestId: "req_2a91",
    requestedAt: NOW - 2 * 60_000,
    durationMs: 124,
    options: { failFast: false, timeoutMs: 6_000 },
    calls: [
      { id: "c1", method: "sessions.list", params: { agentId: "main" } },
      { id: "c2", method: "agents.list", params: {} },
      { id: "c3", method: "channels.list", params: {} },
    ],
    results: [
      { id: "c1", ok: true, result: { sessions: 4 } },
      { id: "c2", ok: true, result: { agents: 5 } },
      { id: "c3", ok: true, result: { channels: 6 } },
    ],
  },
  {
    id: "batch_8c34",
    runtimeId: "rt_eba210",
    requestId: "req_8c34",
    requestedAt: NOW - 8 * 60_000,
    durationMs: 482,
    options: { failFast: true, timeoutMs: 6_000 },
    calls: [
      { id: "c1", method: "usage.cost", params: { days: 14 } },
      { id: "c2", method: "usage.status", params: {} },
      { id: "c3", method: "sessions.usage", params: { range: "7d" } },
    ],
    results: [
      { id: "c1", ok: true },
      {
        id: "c2",
        ok: false,
        error: {
          code: "quota.unknown",
          message: "google sync failed",
          retryable: true,
          retryAfterMs: 30_000,
        },
      },
      { id: "c3", ok: true },
    ],
  },
  {
    id: "batch_4d12",
    runtimeId: "rt_eba210",
    requestId: "req_4d12",
    requestedAt: NOW - 22 * 60_000,
    durationMs: 1_204,
    options: { failFast: false, timeoutMs: 8_000 },
    calls: [
      { id: "c1", method: "subagents.list", params: {} },
      { id: "c2", method: "subagents.lineage", params: { runId: "run_a91" } },
    ],
    results: [
      { id: "c1", ok: true },
      { id: "c2", ok: true },
    ],
  },
  {
    id: "batch_5e80",
    runtimeId: "rt_eba210",
    requestId: "req_5e80",
    requestedAt: NOW - 60 * 60_000,
    durationMs: 64,
    options: { failFast: false },
    calls: [{ id: "c1", method: "gateway.describe", params: {} }],
    results: [{ id: "c1", ok: true }],
  },
];

const BOOTSTRAP = { ok: true };

// Throughput sparkline (last 30 minutes, 30 points).
const THROUGHPUT_POINTS = (() => {
  const points = [];
  for (let i = 29; i >= 0; i--) {
    points.push({
      timestamp: NOW - i * 60_000,
      requests: 18 + Math.round(Math.sin(i / 3.4) * 9 + Math.random() * 6),
      errors: i < 5 ? 0 : Math.round(Math.random() * 1.4),
      latencyP95: 240 + Math.round(Math.cos(i / 5) * 80 + Math.random() * 40),
    });
  }
  return points;
})();

// Audit / event log — feeds the Activity tab + topbar count.
const AUDIT_ENTRIES = [
  {
    ts: NOW - 90_000,
    actor: "operator:user@example.com",
    method: "sessions.create",
    ok: true,
    meta: { agentId: "main" },
  },
  {
    ts: NOW - 240_000,
    actor: "operator:user@example.com",
    method: "alerts.upsert",
    ok: true,
    meta: { ruleId: "rule_42" },
  },
  {
    ts: NOW - 480_000,
    actor: "system",
    method: "channel.disconnect",
    ok: false,
    meta: { channel: "slack", reason: "auth.expired" },
  },
  {
    ts: NOW - 600_000,
    actor: "automation:hooks/budget",
    method: "alerts.delete",
    ok: true,
    meta: { ruleId: "rule_old" },
  },
  {
    ts: NOW - 1_200_000,
    actor: "operator:user@example.com",
    method: "subagents.kill",
    ok: true,
    meta: { runId: "run_77" },
  },
  {
    ts: NOW - 1_800_000,
    actor: "operator:user@example.com",
    method: "skills.install",
    ok: false,
    meta: { id: "openspec-explore", reason: "manifest.invalid" },
  },
  {
    ts: NOW - 3_600_000,
    actor: "operator:user@example.com",
    method: "usage.budget.upsert",
    ok: true,
    meta: { ruleId: "rule_8" },
  },
  {
    ts: NOW - 4_800_000,
    actor: "system",
    method: "agent.start",
    ok: true,
    meta: { agentId: "system" },
  },
];

Object.assign(window, {
  GW_NOW: NOW,
  GW_HEALTH_RESPONSE: HEALTH_RESPONSE,
  GW_STATUS_RESPONSE: STATUS_RESPONSE,
  GW_DESCRIBE_RESPONSE: DESCRIBE_RESPONSE,
  GW_RECENT_BATCHES: RECENT_BATCHES,
  GW_BOOTSTRAP: BOOTSTRAP,
  GW_THROUGHPUT_POINTS: THROUGHPUT_POINTS,
  GW_AUDIT_ENTRIES: AUDIT_ENTRIES,
});
