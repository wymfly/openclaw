// Webhooks fixture — DeckGoWebhook + DeckGoWebhookDelivery shapes from
// deck-api.contract.ts. KPI strip + recent failures aggregate are BFF
// projections.

const NOW = Date.now();
const MIN = 60_000;
const HR = 60 * MIN;
const DAY = 24 * HR;

const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

// -- Available event types (BFF: projected from event bus catalog) --------

const AVAILABLE_EVENTS = [
  "approval.pending",
  "approval.resolved",
  "channel.connected",
  "channel.disconnected",
  "channel.message",
  "cron.run",
  "cron.run.error",
  "session.created",
  "session.closed",
  "alert.fired",
  "alert.cleared",
  "agent.heartbeat",
  "agent.error",
  "deploy.started",
  "deploy.finished",
  "memory.added",
  "monitor.snapshot",
  "plugin.activated",
  "plugin.deactivated",
];

// -- Webhooks --------------------------------------------------------------

const WEBHOOKS = [
  {
    id: "wh-ops-slack",
    name: "Ops Slack alerts",
    url: "https://hooks.slack.com/services/T01XXXXXX/B02YYYYYY/zZzZzZzZ",
    secret: "***ops-slack-redacted",
    events: ["alert.fired", "alert.cleared", "approval.pending", "cron.run.error"],
    enabled: true,
    consecutiveFailures: 0,
    lastFiredAt: iso(2 * MIN),
    lastStatus: 200,
    createdAt: iso(45 * DAY),
    updatedAt: iso(7 * DAY),
  },
  {
    id: "wh-pagerduty",
    name: "PagerDuty critical",
    url: "https://events.pagerduty.com/integration/abcd1234efgh5678/enqueue",
    secret: "***pd-redacted",
    events: ["alert.fired"],
    enabled: true,
    consecutiveFailures: 0,
    lastFiredAt: iso(45 * MIN),
    lastStatus: 202,
    createdAt: iso(120 * DAY),
    updatedAt: iso(60 * DAY),
  },
  {
    id: "wh-github-sync",
    name: "GitHub deploy sync",
    url: "https://api.github.com/repos/openclaw/deck/dispatches",
    secret: "***gh-redacted",
    events: ["deploy.started", "deploy.finished"],
    enabled: true,
    consecutiveFailures: 2,
    lastFiredAt: iso(8 * MIN),
    lastStatus: 422,
    createdAt: iso(30 * DAY),
    updatedAt: iso(3 * DAY),
  },
  {
    id: "wh-flaky-internal",
    name: "Internal QA bridge",
    url: "https://qa.internal.example.com/hooks/deck-events",
    secret: "***qa-redacted",
    events: ["session.created", "session.closed", "memory.added"],
    enabled: true,
    consecutiveFailures: 5,
    lastFiredAt: iso(22 * MIN),
    lastStatus: null,
    createdAt: iso(15 * DAY),
    updatedAt: iso(2 * DAY),
  },
  {
    id: "wh-disabled-relay",
    name: "Old relay (disabled)",
    url: "https://legacy.example.com/relay",
    secret: null,
    events: ["channel.message"],
    enabled: false,
    consecutiveFailures: 0,
    lastFiredAt: iso(28 * DAY),
    lastStatus: 503,
    createdAt: iso(180 * DAY),
    updatedAt: iso(28 * DAY),
  },
  {
    id: "wh-monitor-bridge",
    name: "Monitor → Datadog",
    url: "https://api.datadoghq.com/api/v1/events?api_key=...",
    secret: "***dd-redacted",
    events: ["monitor.snapshot", "agent.error", "agent.heartbeat"],
    enabled: true,
    consecutiveFailures: 0,
    lastFiredAt: iso(38 * 1000),
    lastStatus: 202,
    createdAt: iso(60 * DAY),
    updatedAt: iso(14 * DAY),
  },
];

// -- Deliveries (last 50 across all webhooks) ----------------------------

function makeDelivery(id, webhookId, eventType, msAgo, statusCode, success, opts = {}) {
  return {
    id,
    webhookId,
    eventType,
    payload: JSON.stringify({ event: eventType, ts: NOW - msAgo, ...opts.payload }),
    statusCode: statusCode ?? null,
    responseBody: opts.responseBody ?? null,
    error: opts.error ?? null,
    durationMs: opts.durationMs ?? 200 + Math.floor(Math.random() * 600),
    attempt: opts.attempt || 1,
    isRetry: opts.isRetry || false,
    parentDeliveryId: opts.parentDeliveryId || null,
    success,
    nextRetryAt: opts.nextRetryAt || null,
    createdAt: iso(msAgo),
  };
}

const DELIVERIES = [
  makeDelivery("dlv-001", "wh-ops-slack", "alert.fired", 2 * MIN, 200, true, {
    responseBody: '{"ok":true}',
    durationMs: 245,
  }),
  makeDelivery("dlv-002", "wh-ops-slack", "approval.pending", 14 * MIN, 200, true, {
    durationMs: 312,
  }),
  makeDelivery("dlv-003", "wh-ops-slack", "cron.run.error", 38 * MIN, 200, true, {
    durationMs: 198,
  }),
  makeDelivery("dlv-004", "wh-ops-slack", "alert.cleared", 2 * HR, 200, true, { durationMs: 244 }),
  makeDelivery("dlv-005", "wh-pagerduty", "alert.fired", 45 * MIN, 202, true, {
    durationMs: 412,
    responseBody: '{"status":"success","message":"Event processed"}',
  }),
  makeDelivery("dlv-006", "wh-github-sync", "deploy.started", 8 * MIN, 422, false, {
    durationMs: 1820,
    error: "GitHub API: validation failed",
    responseBody: '{"message":"Validation Failed","documentation_url":"..."}',
  }),
  makeDelivery("dlv-007", "wh-github-sync", "deploy.started", 12 * MIN, 422, false, {
    durationMs: 1730,
    error: "GitHub API: validation failed",
    isRetry: true,
    attempt: 2,
    parentDeliveryId: "dlv-006",
  }),
  makeDelivery("dlv-008", "wh-github-sync", "deploy.finished", 25 * MIN, 200, true, {
    durationMs: 540,
  }),
  makeDelivery("dlv-009", "wh-flaky-internal", "session.created", 22 * MIN, null, false, {
    durationMs: 8000,
    error: "fetch failed: ETIMEDOUT",
  }),
  makeDelivery("dlv-010", "wh-flaky-internal", "session.created", 28 * MIN, null, false, {
    durationMs: 8000,
    error: "fetch failed: ECONNREFUSED",
    isRetry: true,
    attempt: 2,
    parentDeliveryId: "dlv-009",
  }),
  makeDelivery("dlv-011", "wh-flaky-internal", "session.closed", 41 * MIN, null, false, {
    durationMs: 8000,
    error: "fetch failed: ETIMEDOUT",
    nextRetryAt: NOW + 2 * MIN,
  }),
  makeDelivery("dlv-012", "wh-flaky-internal", "memory.added", 58 * MIN, 502, false, {
    durationMs: 1200,
    error: "upstream returned 502",
    responseBody: "<html><body>Bad Gateway</body></html>",
  }),
  makeDelivery("dlv-013", "wh-monitor-bridge", "monitor.snapshot", 38 * 1000, 202, true, {
    durationMs: 178,
  }),
  makeDelivery("dlv-014", "wh-monitor-bridge", "monitor.snapshot", 90 * 1000, 202, true, {
    durationMs: 184,
  }),
  makeDelivery("dlv-015", "wh-monitor-bridge", "agent.error", 5 * MIN, 202, true, {
    durationMs: 211,
  }),
  makeDelivery("dlv-016", "wh-monitor-bridge", "agent.heartbeat", 12 * MIN, 202, true, {
    durationMs: 167,
  }),
  makeDelivery("dlv-017", "wh-monitor-bridge", "agent.heartbeat", 27 * MIN, 202, true, {
    durationMs: 192,
  }),
  makeDelivery("dlv-018", "wh-pagerduty", "alert.fired", 4 * HR, 202, true, { durationMs: 388 }),
  makeDelivery("dlv-019", "wh-pagerduty", "alert.fired", 18 * HR, 202, true, { durationMs: 401 }),
  makeDelivery("dlv-020", "wh-disabled-relay", "channel.message", 28 * DAY, 503, false, {
    durationMs: 5210,
    error: "upstream returned 503",
  }),
];

// -- KPI stats (BFF projection over deliveries) ---------------------------

const KPI_STATS = {
  total: WEBHOOKS.length,
  enabled: WEBHOOKS.filter((w) => w.enabled).length,
  failing: WEBHOOKS.filter((w) => w.consecutiveFailures >= 3).length,
  deliveries24h: 1402,
  successRate24h: 0.964,
  avgDurationMs: 318,
};

const BOOTSTRAP = { ok: true, runtimeVersion: "0.5.0" };

Object.assign(window, {
  AVAILABLE_EVENTS,
  WEBHOOKS,
  DELIVERIES,
  KPI_STATS,
  BOOTSTRAP,
});
