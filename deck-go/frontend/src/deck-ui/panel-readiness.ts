import type { PanelId } from "./panel-registry";

export type PanelReadinessStatus = "ready";

export type PanelReadinessEntry = {
  status: PanelReadinessStatus;
  evidence: string;
};

const READINESS_BY_PANEL: Record<PanelId, PanelReadinessEntry> = {
  chat: {
    status: "ready",
    evidence:
      "Chat uses the active ChatPanel, shared store, API facade, stream recovery path, and collapsible subagent lineage tree; browser E2E evidence remains tracked separately.",
  },
  agents: {
    status: "ready",
    evidence:
      "Agent list/detail/create/update/delete routes back inventory, event streams, subagent spawning, skills, bootstrap files, tools, identity preview, recent sessions, routing bindings, templates, clone flow, SSE metrics, batch export, compare, raw config, fallback-chain, and agent session type filtering. Fields outside the Gateway schema are not exposed.",
  },
  gateway: {
    status: "ready",
    evidence:
      "Bootstrap, /runtime/gateway, /gateway/health, and /gateway/status expose runtime state plus monitor diagnostics, with runtime action buttons gated by current configured/status truth to avoid duplicate or invalid Gateway lifecycle actions.",
  },
  models: {
    status: "ready",
    evidence:
      "Models config, schema lookup, models.mode, api/v1 runtime-configured model inventory, runtime catalog filtering/grouping/detail quick actions, auth overview with OAuth/cooldown diagnostics, catalog providers, search, model selection, probe action, default text/image fallback-chain editing, structured provider config edits, provider headers/model entries, catalog-template fill, custom provider add, model allowlist toggles, per-model metadata, Bedrock discovery edits, and cost/provider quota summaries are available through current model routes.",
  },
  usage: {
    status: "ready",
    evidence:
      "Model usage cost/provider routes plus session usage, logs, timeseries, context-weight details, daily/model trend charting, and usage range shortcuts back the usage surface.",
  },
  sessions: {
    status: "ready",
    evidence:
      "/sessions plus session detail/history routes back session inventory, transcript search/export, inventory filters, cache reuse, and confirmed compact/delete actions.",
  },
  memory: {
    status: "ready",
    evidence:
      "Browse/read/search/health/dreams routes back memory navigation, directory browse versus file read separation, parent navigation, explicit LanceDB-unavailable search degradation, dream maintenance actions, confirmation guards, and knowledge-graph node visibility.",
  },
  logs: {
    status: "ready",
    evidence:
      "/logs and /logs/stream back log tailing, including frontend level/source/session filtering, local clear/pause controls, and filtered export preview.",
  },
  activity: {
    status: "ready",
    evidence:
      "The synthesized activity feed supports live SSE merge, filters, selected-event inspection, time-bucket timeline grouping, monitor stats, monitor run history agent/session/status/time filtering, cursor pagination, detail summary metrics, and parsed model/tool/file/subagent diagnostics backed by /monitor/stats and /monitor/runs.",
  },
  threads: {
    status: "ready",
    evidence:
      "deck.threads.list backs thread inventory, recent-activity sorting, relation diagnostics, copy-session-key, and cross-panel handoff controls.",
  },
  "api-explorer": {
    status: "ready",
    evidence:
      "gateway.describe backs API inspection, including method/event grouping plus decoded schema type, required, enum, object, array inspection, collapsible nested schema rows, and retryable describe refresh after load failures.",
  },
  cron: {
    status: "ready",
    evidence:
      "Scheduler routes back cron schedule templates, create, selected-job edit/save, run now, confirmed delete, status, and run-history inspection.",
  },
  webhooks: {
    status: "ready",
    evidence:
      "Webhook inventory and delivery routes back event toggle selection with raw-event fallback, create, selected-webhook edit/save, test delivery, confirmed delete, structured delivery history with retry/attempt/detail visibility, and raw delivery inspection.",
  },
  approvals: {
    status: "ready",
    evidence:
      "Pending, policy, plugin approval, and shared /stream routes back exec/plugin decisions, structured policy defaults/agent/allowlist editing, approval policy save, and approval.pending/approval.resolved realtime pending-list updates.",
  },
  skills: {
    status: "ready",
    evidence:
      "Skill inventory, update, install, and ClawHub hub routes back enable/disable, apiKey/env config save, install-option actions, hub bins/search/detail/install, and update-all.",
  },
  budget: {
    status: "ready",
    evidence:
      "Budget rules and evaluation routes back scope/period constrained rule editing, create, selected-rule edit/save, enable/disable, confirmed delete, status/progress summaries, rule status badges, and evaluation inspection.",
  },
  alerts: {
    status: "ready",
    evidence:
      "Alerts inventory and rule actions back entity/cooldown form semantics, create, selected-rule edit/save, enable/disable, confirmed delete, rule metadata badges, last-fired/cooldown visibility, and rule inspection over the current alerts facade.",
  },
  channels: {
    status: "ready",
    evidence:
      "channels.status, confirmed logout, channel probe test, throughput, config patch, arbitrary JSON patch, and Gateway channel metadata paths back channel inventory, account normalization, plugin/config metadata, and account health diagnostics. Channel onboarding is limited to the current deck-go contract.",
  },
  plugins: {
    status: "ready",
    evidence:
      "deck.plugins.list backs plugin inventory, including channel/default and all-plugin modes plus typed capability, channel, action, activation, and diagnostics inventory; channels.status gates related-channel handoffs so plugin-declared but currently invisible channels are surfaced as visibility warnings.",
  },
  routing: {
    status: "ready",
    evidence:
      "Routing list, simulate, validate, add, remove, reorder, conflict detection, match-to-simulator, and routing-adjacent activity routes back routing management.",
  },
  subagents: {
    status: "ready",
    evidence:
      "Subagent run, lineage, confirmed kill, steer, per-agent permissions, Gateway-valid agents.defaults.subagents global defaults, and historical run detail back the subagent surface.",
  },
  identity: {
    status: "ready",
    evidence:
      "Identity link/unlink truth is exposed through peer-badge canonical listing, direct peer-badge unlink, empty-peer state, disabled incomplete link drafts, confirmed unlink, and config-hash refresh after failed mutations. Identity scope follows the current link/list/unlink Gateway contract.",
  },
  config: {
    status: "ready",
    evidence:
      "config.get, config.apply, and config.schema.lookup back schema-root section navigation, selected-section value inspection, structured field search/tag filtering, sensitive-field masking, unsaved raw-edit protection, save diff preview, apply-conflict reload/retry, and direct primitive/enum/JSON structured field edits written back to the raw config snapshot.",
  },
  nodes: {
    status: "ready",
    evidence:
      "Node inventory, selected-node detail metadata, lifecycle diagnostics, displayName-correct rename, requestId-correct confirmed approve/reject pairing, orphan pairing-request actions, token verification, Gateway-backed node.invoke, and node.pending.enqueue back node operations.",
  },
  docs: {
    status: "ready",
    evidence:
      "Docs routes back current-session extraction, confirmed delete, local category/search filtering with stable category counts, selected-document metadata, keyword/source/time display, source handoffs, and Markdown content rendering. Editing is limited by the current list/get/delete/extract API.",
  },
  settings: {
    status: "ready",
    evidence:
      "Local settings plus bootstrap/runtime shell and device routes back save, token persistence, managed Gateway auto-start/env edits, connection test, version info, runtime refresh, pending device approve/reject, paired-device remove, token rotate/revoke, self-device protections, and appearance/about actions.",
  },
};

export function getPanelReadiness(id: PanelId) {
  return READINESS_BY_PANEL[id];
}
