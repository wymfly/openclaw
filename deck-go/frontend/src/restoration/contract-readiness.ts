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
    status: "ready-with-adapter",
    evidence:
      "deck-go model usage cost/provider seams now back a restored Vite panel, while deeper session-level analytics remain future adapter work.",
  },
  sessions: {
    status: "ready-with-adapter",
    evidence:
      "Deck-go already exposes /sessions plus session detail/history seams; the missing work is panel-grade restoration, not backend truth.",
  },
  memory: {
    status: "ready-with-adapter",
    evidence:
      "deck-go now exposes read-first browse/search/dreams seams and the restored memory panel consumes them, but deeper authoring flows still need adapter work.",
  },
  logs: {
    status: "ready-with-adapter",
    evidence:
      "/logs and /logs/stream already exist and the current shell consumes log streams, but the legacy logs panel still needs restoration.",
  },
  activity: {
    status: "ready-with-adapter",
    evidence:
      "The synthesized activity feed now has a restored Vite panel, though the richer live SSE/timeline shell is still deferred.",
  },
  threads: {
    status: "ready-with-adapter",
    evidence:
      "deck.threads list truth is now surfaced through a restored Vite panel, but richer thread relation tooling still needs panel-grade adapters.",
  },
  "api-explorer": {
    status: "ready-with-adapter",
    evidence:
      "gateway.describe and related gateway APIs exist, but no restored explorer-specific frontend composition exists yet.",
  },
  cron: {
    status: "ready-with-adapter",
    evidence:
      "The restored cron panel now consumes deck-go scheduler routes, but the legacy editor depth still exceeds the current Vite surface.",
  },
  webhooks: {
    status: "ready-with-adapter",
    evidence:
      "deck-go-backed webhook inventory and delivery seams are restored into Vite, though the richer operator workflow still needs follow-on adapter work.",
  },
  approvals: {
    status: "ready-with-adapter",
    evidence:
      "The approvals panel now runs against deck-go pending/policy routes, but the full approval workflow still needs a richer panel adapter.",
  },
  skills: {
    status: "ready-with-adapter",
    evidence:
      "The restored skills panel is backed by deck-go skill inventory routes, but install/update ergonomics remain thinner than the legacy surface.",
  },
  budget: {
    status: "ready-with-adapter",
    evidence:
      "Budget rules and evaluation routes now have a Vite-facing panel, but broader policy tooling still needs follow-on work.",
  },
  alerts: {
    status: "ready-with-adapter",
    evidence:
      "Alerts inventory is now restored into the Vite host, but alert editing and response flows still need deeper adapter work.",
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
    status: "ready-with-adapter",
    evidence:
      "deck-go routing list and simulate seams now back a restored Vite panel, but full binding-edit parity remains follow-on adapter work.",
  },
  subagents: {
    status: "ready-with-adapter",
    evidence:
      "Subagent run, lineage, kill, and steer seams now have a restored Vite panel, while the deeper historical/config shell remains deferred.",
  },
  identity: {
    status: "ready-with-adapter",
    evidence:
      "deck-go identity link/unlink truth is now exposed through a restored Vite panel, but higher-order identity workflows still need adapter depth.",
  },
  config: {
    status: "ready-with-adapter",
    evidence:
      "config.get, config.patch, config.apply, and config.schema.lookup exist, but the legacy config-editor workflow is deeper than the current frontend.",
  },
  nodes: {
    status: "ready-with-adapter",
    evidence:
      "Node inventory and pair flows now have a restored Vite panel, but the fuller node-management workflow still needs additional UI depth.",
  },
  docs: {
    status: "ready-with-adapter",
    evidence:
      "The docs hub now has a restored Vite panel over deck-go docs routes, though richer curation/editing flows remain future adapter work.",
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
