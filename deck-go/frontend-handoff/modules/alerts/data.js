// Contract-shaped mock data for alerts prototype.
// Shapes match DeckGo* DTOs in deck-go/contracts/source/deck-api.contract.ts:
//   DeckGoAlertAction ("toast" | "activity" | "webhook"),
//   DeckGoAlertRule, DeckGoAlertsResponse, DeckGoAlertRuleResponse.
//
// Note: contract models alert RULES (config), not fire instances. The
// "recent fires" tab is a BFF projection over activity-log events with
// type=alert.fire — flagged in api-usage.md.

const NOW = 1714680000000;
const isoAgo = (ms) => new Date(NOW - ms).toISOString();

window.MOCK = {
  rules: {
    rules: [
      {
        id: "rule_ws_reconnect",
        name: "Discord WebSocket reconnect threshold",
        entityType: "channel",
        condition: "ws_reconnect_count_5m > threshold",
        threshold: 3,
        action: "activity",
        cooldownMs: 5 * 60 * 1000,
        lastFiredAt: isoAgo(8 * 60 * 1000),
        enabled: true,
        createdAt: isoAgo(60 * 86400 * 1000),
        updatedAt: isoAgo(2 * 86400 * 1000),
      },
      {
        id: "rule_failed_runs",
        name: "Subagent failed-run rate",
        entityType: "subagent",
        condition: "failed_runs_15m > threshold",
        threshold: 3,
        action: "toast",
        cooldownMs: 10 * 60 * 1000,
        lastFiredAt: isoAgo(45 * 60 * 1000),
        enabled: true,
        createdAt: isoAgo(45 * 86400 * 1000),
        updatedAt: isoAgo(7 * 86400 * 1000),
      },
      {
        id: "rule_token_burst",
        name: "Per-model token burst",
        entityType: "model",
        condition: "input_tokens_1m > threshold",
        threshold: 50000,
        action: "webhook",
        cooldownMs: 15 * 60 * 1000,
        lastFiredAt: null,
        enabled: true,
        createdAt: isoAgo(120 * 86400 * 1000),
        updatedAt: isoAgo(30 * 86400 * 1000),
      },
      {
        id: "rule_spend_hourly",
        name: "Hourly spend cap (USD)",
        entityType: "budget",
        condition: "spend_usd_1h > threshold",
        threshold: 8,
        action: "webhook",
        cooldownMs: 30 * 60 * 1000,
        lastFiredAt: isoAgo(2 * 3600 * 1000),
        enabled: true,
        createdAt: isoAgo(180 * 86400 * 1000),
        updatedAt: isoAgo(14 * 86400 * 1000),
      },
      {
        id: "rule_approval_expiry",
        name: "Approval expiry without decision",
        entityType: "approval",
        condition: "expired_no_decision > threshold",
        threshold: 1,
        action: "toast",
        cooldownMs: 5 * 60 * 1000,
        lastFiredAt: isoAgo(20 * 60 * 1000),
        enabled: true,
        createdAt: isoAgo(15 * 86400 * 1000),
        updatedAt: isoAgo(15 * 86400 * 1000),
      },
      {
        id: "rule_signal_runtime",
        name: "Signal-CLI runtime missing",
        entityType: "plugin",
        condition: "diagnostic_level=error_persists > threshold",
        threshold: 1,
        action: "activity",
        cooldownMs: 30 * 60 * 1000,
        lastFiredAt: isoAgo(6 * 3600 * 1000),
        enabled: true,
        createdAt: isoAgo(8 * 86400 * 1000),
        updatedAt: isoAgo(2 * 86400 * 1000),
      },
      {
        id: "rule_session_idle",
        name: "Long-idle agent session",
        entityType: "session",
        condition: "idle_minutes > threshold",
        threshold: 60,
        action: "activity",
        cooldownMs: 60 * 60 * 1000,
        lastFiredAt: null,
        enabled: false,
        createdAt: isoAgo(220 * 86400 * 1000),
        updatedAt: isoAgo(220 * 86400 * 1000),
      },
      {
        id: "rule_test_flake",
        name: "Test flake regression",
        entityType: "test",
        condition: "flake_rate_24h_pct > threshold",
        threshold: 5,
        action: "webhook",
        cooldownMs: 4 * 3600 * 1000,
        lastFiredAt: isoAgo(11 * 3600 * 1000),
        enabled: true,
        createdAt: isoAgo(90 * 86400 * 1000),
        updatedAt: isoAgo(11 * 86400 * 1000),
      },
      {
        id: "rule_oauth_rotate",
        name: "OAuth credential approaching expiry",
        entityType: "auth",
        condition: "expires_in_days < threshold",
        threshold: 7,
        action: "toast",
        cooldownMs: 24 * 3600 * 1000,
        lastFiredAt: null,
        enabled: false,
        createdAt: isoAgo(2 * 86400 * 1000),
        updatedAt: isoAgo(2 * 86400 * 1000),
      },
      {
        id: "rule_qa_block",
        name: "QA test block at PR merge",
        entityType: "pr",
        condition: "qa_failures_at_merge > threshold",
        threshold: 1,
        action: "toast",
        cooldownMs: 30 * 60 * 1000,
        lastFiredAt: isoAgo(3 * 86400 * 1000),
        enabled: true,
        createdAt: isoAgo(40 * 86400 * 1000),
        updatedAt: isoAgo(40 * 86400 * 1000),
      },
      {
        id: "rule_ratelimit_429",
        name: "Provider 429 rate-limit cluster",
        entityType: "provider",
        condition: "rate_limit_errors_5m > threshold",
        threshold: 5,
        action: "webhook",
        cooldownMs: 10 * 60 * 1000,
        lastFiredAt: isoAgo(70 * 60 * 1000),
        enabled: true,
        createdAt: isoAgo(15 * 86400 * 1000),
        updatedAt: isoAgo(15 * 86400 * 1000),
      },
      {
        id: "rule_routing_loop",
        name: "Routing loop detected",
        entityType: "routing",
        condition: "redirect_depth > threshold",
        threshold: 5,
        action: "activity",
        cooldownMs: 10 * 60 * 1000,
        lastFiredAt: null,
        enabled: true,
        createdAt: isoAgo(60 * 86400 * 1000),
        updatedAt: isoAgo(20 * 86400 * 1000),
      },
    ],
  },

  // ── BFF projection: recent fires per rule (over alert.fire activity events)
  recentFires: {
    rule_ws_reconnect: [
      { ts: NOW - 8 * 60 * 1000, entityId: "discord/acct_disc_bot", note: "ws reconnect count=4" },
      { ts: NOW - 70 * 60 * 1000, entityId: "discord/acct_disc_bot", note: "ws reconnect count=5" },
      {
        ts: NOW - 4 * 3600 * 1000,
        entityId: "discord/acct_disc_bot",
        note: "ws reconnect count=3",
      },
    ],
    rule_failed_runs: [
      {
        ts: NOW - 45 * 60 * 1000,
        entityId: "test-engineer",
        note: "3 failed runs in 15m (Playwright launch timeout)",
      },
    ],
    rule_spend_hourly: [
      { ts: NOW - 2 * 3600 * 1000, entityId: "budget/main", note: "spend=$12.40 over 1h cap" },
      { ts: NOW - 26 * 3600 * 1000, entityId: "budget/main", note: "spend=$9.10 over 1h cap" },
    ],
    rule_approval_expiry: [
      {
        ts: NOW - 20 * 60 * 1000,
        entityId: "apr_002",
        note: "expired without decision after 10m",
      },
    ],
    rule_signal_runtime: [
      {
        ts: NOW - 6 * 3600 * 1000,
        entityId: "signal-provider",
        note: "diagnostic level=error persists",
      },
    ],
    rule_test_flake: [
      {
        ts: NOW - 11 * 3600 * 1000,
        entityId: "deck-go/agents-real-gateway.spec.ts",
        note: "flake rate 6.2% across 12 runs",
      },
    ],
    rule_qa_block: [
      {
        ts: NOW - 3 * 86400 * 1000,
        entityId: "PR#1234",
        note: "qa-tests blocking merge",
      },
    ],
    rule_ratelimit_429: [
      {
        ts: NOW - 70 * 60 * 1000,
        entityId: "anthropic/claude-opus-4-7",
        note: "8 × 429 in 5m",
      },
    ],
  },

  // ── BFF projection: per-rule audit (create / edit / disable / enable)
  audit: {
    rule_ws_reconnect: [
      { ts: NOW - 60 * 86400 * 1000, actor: "wangym", action: "created" },
      { ts: NOW - 30 * 86400 * 1000, actor: "wangym", action: "edited", note: "threshold 5 → 3" },
      {
        ts: NOW - 2 * 86400 * 1000,
        actor: "system",
        action: "edited",
        note: "action toast → activity",
      },
    ],
    rule_oauth_rotate: [{ ts: NOW - 2 * 86400 * 1000, actor: "wangym", action: "created" }],
    rule_signal_runtime: [
      { ts: NOW - 8 * 86400 * 1000, actor: "system", action: "auto-created" },
      { ts: NOW - 2 * 86400 * 1000, actor: "wangym", action: "edited", note: "cooldown 15m → 30m" },
    ],
  },

  // Entity universe for the create/edit form.
  entityTypes: [
    "channel",
    "model",
    "subagent",
    "budget",
    "approval",
    "plugin",
    "session",
    "test",
    "auth",
    "pr",
    "provider",
    "routing",
  ],

  kpis: { asOfMs: NOW, runtimeId: "deck-runtime-prod-01" },
};
