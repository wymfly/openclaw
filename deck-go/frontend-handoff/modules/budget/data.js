// data.js — fixture for the budget workbench.
//
// Source contract: deck-go/contracts/source/deck-api.contract.ts
//   DeckGoBudgetDimension      = "tokensIn" | "tokensOut" | "totalTokens" | "cost"
//   DeckGoBudgetStatus         = "ok" | "warn" | "over"
//   DeckGoBudgetRule           = { id, name, scope, agentId, taskId, dimension, warnThreshold, overThreshold, period, enabled, createdAt, updatedAt }
//   DeckGoBudgetEvaluation     = { ruleId, ruleName, status, current, warnThreshold, overThreshold, dimension }
//   DeckGoBudgetRulesResponse  = { rules: DeckGoBudgetRule[] }
//   DeckGoBudgetEvaluationsResponse = { evaluations: DeckGoBudgetEvaluation[] }
//
// Endpoints:
//   GET  /api/deck/budget/rules        → DeckGoBudgetRulesResponse
//   GET  /api/deck/budget/evaluations  → DeckGoBudgetEvaluationsResponse
//   POST /api/deck/budget/rules        → create rule (prototype-assumed)
//   PATCH /api/deck/budget/rules/{id}  → update rule (prototype-assumed)
//   DELETE /api/deck/budget/rules/{id} → delete rule (prototype-assumed)

(function (root) {
  const NOW = Date.parse("2026-05-04T11:42:00Z");

  const rules = [
    {
      id: "rule-1",
      name: "Daily cost cap (all agents)",
      scope: "global",
      agentId: null,
      taskId: null,
      dimension: "cost",
      warnThreshold: 8.0,
      overThreshold: 12.0,
      period: "day",
      enabled: true,
      createdAt: "2026-03-09T08:00:00Z",
      updatedAt: "2026-04-29T10:11:00Z",
    },
    {
      id: "rule-2",
      name: "Hourly token output (main agent)",
      scope: "agent",
      agentId: "main",
      taskId: null,
      dimension: "tokensOut",
      warnThreshold: 80_000,
      overThreshold: 120_000,
      period: "hour",
      enabled: true,
      createdAt: "2026-03-12T14:00:00Z",
      updatedAt: "2026-04-30T08:42:00Z",
    },
    {
      id: "rule-3",
      name: "Weekly total tokens (oncall-rotation)",
      scope: "agent",
      agentId: "oncall-rotation",
      taskId: null,
      dimension: "totalTokens",
      warnThreshold: 1_500_000,
      overThreshold: 2_000_000,
      period: "week",
      enabled: true,
      createdAt: "2026-03-21T09:00:00Z",
      updatedAt: "2026-04-12T11:00:00Z",
    },
    {
      id: "rule-4",
      name: "Daily input tokens (build-bot)",
      scope: "agent",
      agentId: "build-bot",
      taskId: null,
      dimension: "tokensIn",
      warnThreshold: 600_000,
      overThreshold: 900_000,
      period: "day",
      enabled: false,
      createdAt: "2026-04-02T15:00:00Z",
      updatedAt: "2026-04-30T18:00:00Z",
    },
    {
      id: "rule-5",
      name: "Per-task cost ceiling (review-pool)",
      scope: "task",
      agentId: null,
      taskId: "review-pool/*",
      dimension: "cost",
      warnThreshold: 0.4,
      overThreshold: 0.75,
      period: "task",
      enabled: true,
      createdAt: "2026-04-15T12:00:00Z",
      updatedAt: "2026-04-26T10:00:00Z",
    },
    {
      id: "rule-6",
      name: "Monthly cost cap (entire workspace)",
      scope: "workspace",
      agentId: null,
      taskId: null,
      dimension: "cost",
      warnThreshold: 240,
      overThreshold: 320,
      period: "month",
      enabled: true,
      createdAt: "2026-01-09T08:00:00Z",
      updatedAt: "2026-04-30T22:00:00Z",
    },
    {
      id: "rule-7",
      name: "Hourly token output (channels.discord)",
      scope: "channel",
      agentId: null,
      taskId: null,
      dimension: "tokensOut",
      warnThreshold: 30_000,
      overThreshold: 60_000,
      period: "hour",
      enabled: true,
      createdAt: "2026-04-22T11:00:00Z",
      updatedAt: "2026-04-22T11:00:00Z",
    },
  ];

  const evaluations = [
    {
      ruleId: "rule-1",
      ruleName: "Daily cost cap (all agents)",
      status: "warn",
      current: 9.43,
      warnThreshold: 8.0,
      overThreshold: 12.0,
      dimension: "cost",
    },
    {
      ruleId: "rule-2",
      ruleName: "Hourly token output (main agent)",
      status: "ok",
      current: 42_180,
      warnThreshold: 80_000,
      overThreshold: 120_000,
      dimension: "tokensOut",
    },
    {
      ruleId: "rule-3",
      ruleName: "Weekly total tokens (oncall-rotation)",
      status: "over",
      current: 2_184_000,
      warnThreshold: 1_500_000,
      overThreshold: 2_000_000,
      dimension: "totalTokens",
    },
    {
      ruleId: "rule-4",
      ruleName: "Daily input tokens (build-bot)",
      status: "ok",
      current: 0,
      warnThreshold: 600_000,
      overThreshold: 900_000,
      dimension: "tokensIn",
    },
    {
      ruleId: "rule-5",
      ruleName: "Per-task cost ceiling (review-pool)",
      status: "ok",
      current: 0.21,
      warnThreshold: 0.4,
      overThreshold: 0.75,
      dimension: "cost",
    },
    {
      ruleId: "rule-6",
      ruleName: "Monthly cost cap (entire workspace)",
      status: "warn",
      current: 254.7,
      warnThreshold: 240,
      overThreshold: 320,
      dimension: "cost",
    },
    {
      ruleId: "rule-7",
      ruleName: "Hourly token output (channels.discord)",
      status: "ok",
      current: 12_400,
      warnThreshold: 30_000,
      overThreshold: 60_000,
      dimension: "tokensOut",
    },
  ];

  const recentChanges = [
    {
      ts: NOW - 4 * 60 * 1000,
      actor: "operator:daisy@deck.local",
      ruleId: "rule-1",
      kind: "update",
      note: "warn threshold 6.5 → 8.0",
      ok: true,
    },
    {
      ts: NOW - 31 * 60 * 1000,
      actor: "operator:sam@deck.local",
      ruleId: "rule-3",
      kind: "update",
      note: "over threshold 1.8M → 2.0M",
      ok: true,
    },
    {
      ts: NOW - 6 * 60 * 60_000,
      actor: "operator:daisy@deck.local",
      ruleId: "rule-7",
      kind: "create",
      note: "added discord channel cap",
      ok: true,
    },
    {
      ts: NOW - 11 * 60 * 60_000,
      actor: "automation:hooks/budget",
      ruleId: "rule-4",
      kind: "disable",
      note: "auto-disabled after 3 over events",
      ok: true,
    },
  ];

  const fixture = {
    fetchedAt: NOW,
    rules,
    evaluations,
    recentChanges,
    bootstrap: {
      ok: true,
      runtime: { mode: "remote", status: "running", health: "healthy" },
      gateway: { connected: true, schemaVersion: "2026-04-29-v3" },
    },
    agentDirectory: [
      { id: "main", label: "Daisy 🌼" },
      { id: "build-bot", label: "Build Bot" },
      { id: "oncall-rotation", label: "Oncall Rotation" },
      { id: "review-pool", label: "Review Pool" },
      { id: "system", label: "System" },
    ],
  };

  root.BUDGET_FIXTURE = fixture;
})(typeof window !== "undefined" ? window : globalThis);
