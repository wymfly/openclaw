/* deck-go logs prototype v2 — mock data
 *
 * Contract source: DeckGoLogsTailResponse + DeckGoLogStreamEvent
 *   `lines: unknown[]` — free-form. Prototype assumes the shape:
 *     { ts: ISO8601, level, source, sessionKey, message, correlationId?, fields?, stack? }
 *   See api-usage.md "BFF projection assumption" section.
 */

const LEVELS = ["debug", "info", "warn", "error"];
const SOURCES = ["gateway", "agent", "channel", "tool", "deck-bff", "scheduler", "router", "http"];
const SESSIONS = [
  "sess-main",
  "sess-build",
  "sess-onboarding",
  "sess-codex",
  "sess-codex-2",
  "sess-cron",
  "sess-feedback",
  "sess-tools",
  "sess-incident-2026-05-03",
];

const MESSAGE_BANK = {
  gateway: {
    debug: [
      "websocket heartbeat acknowledged channel=discord account=ops-bot",
      "rpc dispatch deck.agents.list latencyMs=12",
      "transport peer ack peerId=tcp-127.0.0.1-49382",
      "schema cache hit method=deck.config.get etag=cfg-77",
    ],
    info: [
      "gateway ready bind=127.0.0.1:18789 runtime=bundled",
      "client subscribed feed=activity sessionKey={sess}",
      "session opened sessionKey={sess} version=v0.7.4",
      "rpc completed deck.alerts.test-fire ms=243",
    ],
    warn: [
      "transport backpressure peer={sess} queued=132 ceiling=200",
      "rpc deprecated path deck.legacy.* sessionKey={sess}",
      "tls cert expires within 30 days",
    ],
    error: [
      "rpc dispatch failed method=deck.tools.run sessionKey={sess} reason=schema_violation",
      "transport closed unexpectedly sessionKey={sess} reason=upstream_reset",
    ],
  },
  agent: {
    debug: [
      "tool plan candidate=read_file tokens=812 sessionKey={sess}",
      "memory recall hit slot=conversation tokens=1.4k sessionKey={sess}",
      "guardrail evaluate sessionKey={sess} verdict=allow",
    ],
    info: [
      "agent step start sessionKey={sess} step=42",
      "agent step complete sessionKey={sess} step=42 latencyMs=4119",
      "tool call success sessionKey={sess} tool=run_tests duration=18.2s",
      "agent handoff main→codex sessionKey={sess}",
    ],
    warn: [
      "tool retry scheduled sessionKey={sess} method=deck.agents.chat.start attempt=2",
      "model fallback gpt-5.4→gpt-5.5 sessionKey={sess} reason=rate_limit",
      "context approaching ceiling sessionKey={sess} used=187k cap=200k",
    ],
    error: [
      'agent handoff failed sessionKey={sess} reason="upstream timeout"',
      'tool call rejected sessionKey={sess} tool=apply_patch reason="precondition_failed"',
    ],
  },
  channel: {
    debug: [
      "websocket heartbeat acknowledged channel=discord account=ops-bot",
      "qq webhook dedupe key=msg-991283 sessionKey={sess}",
      "telegram webhook delivered offset=2381",
    ],
    info: [
      "discord channel reconnected guild=ops-zone latencyMs=147",
      "wecom message dispatched channel=service group=eng-leads",
      "slack rate limiter renewed channel=slack-platform",
    ],
    warn: [
      "discord rate limit hit retryAfterMs=1500",
      "webhook signature soft mismatch endpoint=/wecom/inbound",
    ],
    error: [
      'wecom send failed errcode=45033 errmsg="api freq out of limit"',
      'telegram getUpdates failed status=502 reason="bad gateway"',
    ],
  },
  tool: {
    debug: [
      "tool sandbox start name=run_tests cwd=/tmp/deck-build",
      "tool sandbox stdout truncated bytes=98231",
    ],
    info: [
      "tool finished ok name=read_file ms=18",
      "tool finished ok name=apply_patch files=3 ms=119",
    ],
    warn: ["tool sandbox deadline reached name=run_tests durationS=119"],
    error: [
      'tool finished error name=apply_patch reason="conflict in app.tsx"',
      'tool finished error name=run_tests reason="exit code 1"',
    ],
  },
  "deck-bff": {
    debug: [
      "projection refresh feed=alerts ms=43",
      "cache evict key=deck.activity.cursor:42198 reason=ttl",
    ],
    info: [
      "config snapshot version=cfg-77 sessionKey={sess}",
      "alert evaluation rule=ag-4 fired=false reason=cooldown",
    ],
    warn: ["projection backlog feed=activity lag=4.7s", "config snapshot stale version=cfg-76"],
    error: [
      "projection rebuild failed feed=alerts reason=corrupt_index",
      "config snapshot mutate rejected version=cfg-77 reason=etag_mismatch",
    ],
  },
  scheduler: {
    debug: ["cron tick cron=models-rotate next=2026-05-03T09:00Z"],
    info: ["cron fired job=cron-models-rotate sessionKey={sess}"],
    warn: ["cron skipped job=cron-models-rotate reason=already_running"],
    error: ['cron failed job=cron-cache-purge reason="redis connection refused"'],
  },
  router: {
    debug: ["route resolve method=deck.agents.detail handler=local"],
    info: ["route registered method=deck.alerts.* count=5"],
    warn: ["route shadow method=deck.legacy.metrics shadowedBy=deck.usage.metrics"],
    error: ["route not found method=deck.unknown.foo sessionKey={sess}"],
  },
  http: {
    debug: ["http request GET /api/deck/alerts ms=27 status=200"],
    info: ["http request POST /api/deck/agents/main/chat ms=219 status=200"],
    warn: ["http request GET /api/deck/usage/cost ms=2173 status=200 slow"],
    error: ["http request GET /api/deck/threads/sess-main ms=4500 status=502"],
  },
};

const STACK_SAMPLES = {
  agent: `Error: upstream timeout for visual fixture
    at AgentHandoff.dispatch (agent/handoff.ts:184:11)
    at AgentHandoff.run (agent/handoff.ts:142:5)
    at AgentSession.step (agent/session.ts:412:9)
    at runAgentLoop (gateway/dispatcher.ts:312:11)
    at GatewayServer.handleRpc (gateway/server.ts:201:7)`,
  gateway: `Error: schema_violation: deck.tools.run: missing required field "args"
    at validateRpc (gateway/protocol/validate.ts:88:11)
    at GatewayDispatcher.dispatch (gateway/dispatcher.ts:172:5)
    at GatewayServer.handleRpc (gateway/server.ts:201:7)`,
  channel: `WeComApiError: 45033 api freq out of limit
    at WeComClient.send (channels/wecom/client.ts:312:13)
    at ChannelGateway.dispatch (channels/gateway.ts:88:11)
    at GatewayServer.handleEvent (gateway/server.ts:148:5)`,
  tool: `Error: conflict in app.tsx
    at applyPatchInternal (tools/apply_patch.ts:412:9)
    at ToolRunner.execute (tools/runner.ts:84:11)
    at AgentSession.callTool (agent/session.ts:512:9)`,
  "deck-bff": `Error: corrupt_index for feed=alerts
    at ProjectionStore.rebuild (bff/projection-store.ts:188:11)
    at ProjectionScheduler.tick (bff/scheduler.ts:62:5)`,
  scheduler: `Error: redis connection refused: connect ECONNREFUSED 127.0.0.1:6379
    at TCPConnectWrap.afterConnect (net.js:1141:16)`,
  router: `Error: route not found: deck.unknown.foo
    at MethodRegistry.resolve (gateway/method-registry.ts:74:11)`,
  http: `FetchError: gateway timeout
    at fetchAdapter (lib/fetch.ts:52:11)
    at apiClient.get (api/client.ts:188:7)`,
};

const CORRELATION_BANK = [
  "trace-9d8a2f",
  "trace-6c14ee",
  "trace-2bf701",
  "trace-d04992",
  "trace-aa1130",
  "trace-77c021",
  "trace-39bb0c",
  "trace-50f883",
  "trace-feec22",
  "trace-c91205",
];

const FIELD_BANK = {
  gateway: () => ({
    method: pick([
      "deck.agents.list",
      "deck.alerts.test-fire",
      "deck.config.get",
      "deck.tools.run",
    ]),
    latencyMs: rndInt(8, 1840),
    peerId: `tcp-127.0.0.1-${rndInt(40000, 60000)}`,
  }),
  agent: () => ({
    step: rndInt(1, 90),
    tokens: rndInt(120, 6400),
    model: pick(["sonnet-4.6", "sonnet-4.6", "gpt-5.4", "opus-4.7", "gpt-5.5"]),
  }),
  channel: () => ({
    channel: pick(["discord", "telegram", "wecom", "slack", "qq"]),
    account: pick(["ops-bot", "service", "main", "alerts", "studio"]),
  }),
  tool: () => ({
    name: pick(["read_file", "apply_patch", "run_tests", "search", "write_file"]),
    durationMs: rndInt(8, 28000),
  }),
  "deck-bff": () => ({
    feed: pick(["alerts", "activity", "config", "models", "channels"]),
    version: `cfg-${rndInt(50, 199)}`,
  }),
  scheduler: () => ({
    job: pick(["cron-models-rotate", "cron-cache-purge", "cron-snapshot-prune"]),
  }),
  router: () => ({
    method: pick(["deck.agents.list", "deck.legacy.metrics", "deck.usage.summary"]),
  }),
  http: () => ({
    path: pick(["/api/deck/alerts", "/api/deck/agents/main/chat", "/api/deck/usage/cost"]),
    status: pick([200, 200, 200, 200, 304, 502]),
  }),
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rndInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function buildLines(count) {
  const lines = [];
  let cursor = 4500;
  let ts = Date.parse("2026-05-03T08:30:00Z");
  for (let i = 0; i < count; i += 1) {
    const source = pick(SOURCES);
    const level =
      Math.random() < 0.7
        ? "info"
        : Math.random() < 0.6
          ? "debug"
          : Math.random() < 0.6
            ? "warn"
            : "error";
    const session = pick(SESSIONS);
    const correlationId = Math.random() < 0.55 ? pick(CORRELATION_BANK) : undefined;
    const messageTpl = pick(MESSAGE_BANK[source][level]);
    const message = messageTpl.replace(/\{sess\}/g, session);
    ts += rndInt(120, 12000);
    cursor -= 1;
    const line = {
      cursor,
      ts: new Date(ts).toISOString(),
      level,
      source,
      sessionKey: session,
      message,
      correlationId,
      fields: FIELD_BANK[source](),
    };
    if (level === "error") {
      line.stack = STACK_SAMPLES[source];
    }
    lines.push(line);
  }
  return lines.reverse();
}

const seedLines = (() => {
  const random = mulberry32(0x29adf3);
  const original = Math.random;
  Math.random = random;
  const out = buildLines(124);
  Math.random = original;
  return out;
})();

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const tailResponse = {
  cursor: seedLines[0]?.cursor ?? 4500,
  reset: false,
  lines: seedLines,
};

const liveTape = [
  {
    id: "evt-log-4498",
    event: "log.batch",
    json: { cursor: 4498, lines: 2 },
    summary: "log batch (2 lines, cursor 4498)",
  },
  {
    id: "evt-log-4495",
    event: "log.batch",
    json: { cursor: 4495, lines: 1 },
    summary: "log batch (1 line, cursor 4495)",
  },
  {
    id: "evt-log-4493",
    event: "log.reset",
    json: { reset: true, cursor: 4493 },
    summary: "log reset (cursor 4493)",
  },
  {
    id: "evt-log-4490",
    event: "log.batch",
    json: { cursor: 4490, lines: 4 },
    summary: "log batch (4 lines, cursor 4490)",
  },
];

Object.assign(window, {
  __logsData: {
    levels: LEVELS,
    sources: SOURCES,
    sessions: SESSIONS,
    correlations: CORRELATION_BANK,
    tail: tailResponse,
    tape: liveTape,
  },
});
