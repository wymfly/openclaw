import type { RestoredPanelId } from "./panel-registry";

export type RestorationReadinessStatus = "ready" | "ready-with-adapter" | "frontend-blocked";

type RestorationReadinessEntry = {
  status: RestorationReadinessStatus;
  evidence: string;
};

const READINESS_BY_PANEL: Record<RestoredPanelId, RestorationReadinessEntry> = {
  chat: {
    status: "ready-with-adapter",
    evidence:
      "Current deck-go chat/session APIs and stream seams exist, but the legacy chat panel composition still needs a panel-grade adapter.",
  },
  agents: {
    status: "frontend-blocked",
    evidence:
      "Legacy agent detail/list workflow is not yet restored against deck-go-owned frontend structure.",
  },
  gateway: {
    status: "ready-with-adapter",
    evidence:
      "Bootstrap and /runtime/gateway already expose runtime truth, but the legacy monitor panel still needs frontend remapping.",
  },
  models: {
    status: "frontend-blocked",
    evidence:
      "Current deck-go surface does not yet expose a restored models panel contract comparable to legacy ModelsPanel expectations.",
  },
  usage: {
    status: "frontend-blocked",
    evidence:
      "No usage panel family restoration contract is visible in the current deck-go frontend/backend surface.",
  },
  sessions: {
    status: "ready-with-adapter",
    evidence:
      "Deck-go already exposes /sessions plus session detail/history seams; the missing work is panel-grade restoration, not backend truth.",
  },
  memory: {
    status: "frontend-blocked",
    evidence: "No memory panel family surface is restored in deck-go yet.",
  },
  logs: {
    status: "ready-with-adapter",
    evidence:
      "/logs and /logs/stream already exist and the current shell consumes log streams, but the legacy logs panel still needs restoration.",
  },
  activity: {
    status: "frontend-blocked",
    evidence: "No restored activity timeline surface exists yet.",
  },
  threads: {
    status: "frontend-blocked",
    evidence: "No thread panel contract or façade is visible in the current deck-go surface.",
  },
  "api-explorer": {
    status: "ready-with-adapter",
    evidence:
      "gateway.describe and related gateway APIs exist, but no restored explorer-specific frontend composition exists yet.",
  },
  cron: {
    status: "frontend-blocked",
    evidence: "No cron or scheduler panel contract is currently surfaced in deck-go.",
  },
  webhooks: {
    status: "frontend-blocked",
    evidence: "No webhooks panel contract is currently surfaced in deck-go.",
  },
  approvals: {
    status: "frontend-blocked",
    evidence:
      "Approval still exists mainly as a shell slot; no dedicated deck-go approvals façade is restored yet.",
  },
  skills: {
    status: "frontend-blocked",
    evidence: "No skills panel contract is currently surfaced in deck-go.",
  },
  budget: {
    status: "frontend-blocked",
    evidence: "No budget panel contract is currently surfaced in deck-go.",
  },
  alerts: {
    status: "frontend-blocked",
    evidence: "No alerts panel contract is currently surfaced in deck-go.",
  },
  channels: {
    status: "ready-with-adapter",
    evidence:
      "channels.status, logout, and config patch paths exist, but the full legacy channels panel family is richer than the current deck-go contract.",
  },
  plugins: {
    status: "ready-with-adapter",
    evidence:
      "deck.plugins.list exists, but the legacy plugins panel behavior needs more than inventory listing.",
  },
  routing: {
    status: "frontend-blocked",
    evidence: "No restored routing façade or simulator-specific deck-go surface is present yet.",
  },
  subagents: {
    status: "frontend-blocked",
    evidence: "No dedicated subagent contract or façade is restored yet.",
  },
  identity: {
    status: "frontend-blocked",
    evidence: "No identity panel-facing deck-go contract is currently surfaced.",
  },
  config: {
    status: "ready-with-adapter",
    evidence:
      "config.get, config.patch, config.apply, and config.schema.lookup exist, but the legacy config-editor workflow is deeper than the current frontend.",
  },
  nodes: {
    status: "frontend-blocked",
    evidence: "No node-management-specific deck-go frontend contract is restored yet.",
  },
  docs: {
    status: "frontend-blocked",
    evidence: "No docs hub contract is currently surfaced in deck-go.",
  },
  settings: {
    status: "ready-with-adapter",
    evidence:
      "Local settings plus bootstrap/runtime shell already exist, but they are not yet restructured as the legacy settings panel.",
  },
};

export function getRestorationReadiness(id: RestoredPanelId) {
  return READINESS_BY_PANEL[id];
}
