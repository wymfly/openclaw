#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_OUT_DIR = ".omx/artifacts/deck-full-visual-parity-comparison";

const groups = [
  {
    id: "shell",
    label: "Shell/App frame",
    oldAuthority: "dashboard/src/components/layout, dashboard/src/app/page.tsx",
    currentTarget: "deck-go/frontend/src/deck-ui, deck-go/frontend/src/deck-ui/App.tsx",
    states: [
      "expanded nav and active panel header",
      "collapsed nav",
      "gateway status",
      "toast container",
      "keyboard shortcuts dialog",
      "panel loading fallback",
      "panel error boundary",
    ],
  },
  {
    id: "chat",
    label: "Chat",
    oldAuthority: "dashboard/src/components/panels/chat",
    currentTarget: "deck-go/frontend/src/components/panels/chat",
    states: [
      "empty chat",
      "active transcript",
      "bash tool result",
      "diff tool result",
      "highlighted file/read result",
      "markdown/json/table/code/html renderer",
      "approval pending dialog",
      "right panel canvas/A2UI",
      "streaming/status banner",
      "subagent lineage/card",
      "transcript search/filter active",
      "slash command palette",
      "mention popover",
    ],
  },
  {
    id: "core",
    label: "Core",
    panels: [
      [
        "agents",
        "Agents",
        "list/detail workspace",
        "tabs",
        "file/tools/skills views",
        "compare mode",
        "config editor",
        "empty/error",
      ],
      [
        "gateway",
        "Gateway",
        "overview",
        "health/connection",
        "live feed",
        "history/timeline",
        "run timeline/tool waterfall",
        "unavailable-state rows",
      ],
      [
        "models",
        "Models",
        "catalog",
        "provider config",
        "fallback chains",
        "usage/quota",
        "provider add/apply flow",
        "empty/error",
      ],
    ],
  },
  {
    id: "observe",
    label: "Observe",
    panels: [
      [
        "usage",
        "Usage",
        "summary cards",
        "trend chart",
        "date range",
        "breakdown table",
        "latency/context pressure",
        "session usage",
      ],
      [
        "sessions",
        "Sessions",
        "list/detail",
        "turn timeline",
        "transcript search",
        "export",
        "compaction history",
        "context health/scope",
      ],
      [
        "memory",
        "Memory",
        "file tree",
        "search",
        "knowledge graph",
        "health diagnostics",
        "dream diary/unavailable state",
      ],
      [
        "logs",
        "Logs",
        "filters",
        "stream viewport",
        "pause/resume",
        "export",
        "loading/empty/error",
      ],
      [
        "activity",
        "Activity",
        "timeline",
        "SSE status",
        "filters",
        "run detail/unavailable state",
        "loading/empty/error",
      ],
      ["threads", "Threads", "list/detail", "relation view", "empty/error"],
      [
        "api-explorer",
        "API Explorer",
        "method list/detail",
        "schema viewer",
        "event list",
        "request/response",
        "error feedback",
      ],
    ],
  },
  {
    id: "automate",
    label: "Automate",
    panels: [
      [
        "cron",
        "Cron/Scheduler",
        "job list",
        "create/edit form",
        "run history",
        "run-now",
        "next execution",
        "heartbeat config",
      ],
      [
        "webhooks",
        "Webhooks",
        "list",
        "creation/edit form",
        "delivery history",
        "validation/error feedback",
      ],
      [
        "approvals",
        "Approvals",
        "pending approvals",
        "plugin approvals",
        "policy editor",
        "path allowlist",
        "stream/action feedback",
      ],
      [
        "skills",
        "Skills",
        "list",
        "hub",
        "info",
        "config",
        "matrix",
        "install/configure dialog",
        "loading/empty/error",
      ],
    ],
  },
  {
    id: "control",
    label: "Control",
    panels: [
      ["budget", "Budget", "status cards", "rule list", "create/edit form", "validation/error"],
      ["alerts", "Alerts", "rule list", "fired alerts", "create/edit form", "validation/error"],
      [
        "channels",
        "Channels",
        "list/detail",
        "settings",
        "access",
        "bindings",
        "analytics",
        "health/probe",
        "onboarding/wizard/access descriptors",
      ],
      ["plugins", "Plugins", "list/detail", "metadata", "action state", "unavailable actions"],
      [
        "routing",
        "Routing",
        "binding table",
        "condition builder",
        "conflict badge",
        "simulator",
        "activity feed",
      ],
      [
        "subagents",
        "Subagents",
        "active runs",
        "config",
        "history",
        "steer dialog",
        "lineage/detail",
      ],
      ["identity", "Identity", "list", "link dialog", "unlink/confirmation", "empty/error"],
      [
        "config",
        "Config",
        "section navigation",
        "schema form",
        "field help",
        "search/highlight",
        "conflict dialog",
        "diff preview",
      ],
      ["nodes", "Nodes", "node cards", "pairing requests", "lifecycle states", "node actions"],
      ["docs", "Docs", "category filter", "document list", "document viewer", "empty/error"],
      [
        "settings",
        "Settings",
        "about",
        "appearance",
        "connection",
        "devices",
        "notifications",
        "pending requests",
        "token rotation",
        "confirm actions",
      ],
    ],
  },
];

const oldPanelDir = {
  "api-explorer": "api-explorer",
  config: "config-editor",
  cron: "scheduler",
  gateway: "monitor",
};

const currentPanelDir = {
  "api-explorer": "api-explorer",
  config: "config",
};

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function oldAuthority(panelId) {
  return `dashboard/src/components/panels/${oldPanelDir[panelId] ?? panelId}`;
}

function currentTarget(panelId) {
  return `deck-go/frontend/src/components/panels/${currentPanelDir[panelId] ?? panelId}`;
}

function expandRows() {
  const rows = [];
  for (const group of groups) {
    if (group.states) {
      for (const state of group.states) {
        const rowId = `${group.id}-${slug(state)}`;
        rows.push({
          id: rowId,
          group: group.label,
          panel: group.label,
          state,
          oldAuthority: group.oldAuthority,
          currentTarget: group.currentTarget,
        });
      }
      continue;
    }
    for (const [panelId, label, ...states] of group.panels) {
      for (const state of states) {
        const rowId = `${panelId}-${slug(state)}`;
        rows.push({
          id: rowId,
          group: group.label,
          panel: label,
          state,
          oldAuthority: oldAuthority(panelId),
          currentTarget: currentTarget(panelId),
        });
      }
    }
  }
  return rows;
}

function artifactPath(row, side) {
  return `screenshots/${row.id}-${side}-en-dark.png`;
}

function esc(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => esc(cell)).join(" | ")} |`),
  ].join("\n");
}

function renderScreenshotMatrix(rows) {
  return `# Deck Full Visual Parity Screenshot Matrix

Generated: ${new Date().toISOString()}

Initial status is \`needs-capture\`. Do not change a row to \`pass\` until both
old and current screenshots exist and the row has console/page-error review.

${table(
  [
    "ID",
    "Group",
    "Panel",
    "State",
    "Locale",
    "Theme",
    "Old reference",
    "Current target",
    "Old artifact",
    "Current artifact",
    "Status",
    "Verdict note",
  ],
  rows.map((row) => [
    row.id,
    row.group,
    row.panel,
    row.state,
    "en",
    "dark",
    row.oldAuthority,
    row.currentTarget,
    artifactPath(row, "old"),
    artifactPath(row, "current"),
    "needs-capture",
    "",
  ]),
)}
`;
}

function renderAuthorityLedger(rows) {
  const byPanel = new Map();
  for (const row of rows) {
    const key = `${row.group}::${row.panel}`;
    if (!byPanel.has(key)) {
      byPanel.set(key, {
        group: row.group,
        panel: row.panel,
        oldAuthority: row.oldAuthority,
        currentTarget: row.currentTarget,
        states: [],
      });
    }
    byPanel.get(key).states.push(row.state);
  }
  return `# Panel Authority Ledger

Generated: ${new Date().toISOString()}

${table(
  ["Group", "Panel", "Old authority", "Current target", "States"],
  [...byPanel.values()].map((entry) => [
    entry.group,
    entry.panel,
    entry.oldAuthority,
    entry.currentTarget,
    entry.states.join("; "),
  ]),
)}
`;
}

function renderInteractionAudit(rows) {
  return `# Interaction Audit

Generated: ${new Date().toISOString()}

Each row starts as \`needs-capture\`. Update evidence with the exact interaction
used in Playwright MCP and whether the old/current behavior matched.

${table(
  ["ID", "Panel", "State", "Required interaction evidence", "Status", "Notes"],
  rows.map((row) => [
    row.id,
    row.panel,
    row.state,
    "nav/tabs/dialogs/forms/lists/empty-loading-error as applicable",
    "needs-capture",
    "",
  ]),
)}
`;
}

function renderI18nAudit(rows) {
  const panels = [...new Map(rows.map((row) => [`${row.group}::${row.panel}`, row])).values()];
  return `# I18n Audit

Generated: ${new Date().toISOString()}

Proper nouns, API identifiers, code, tokens, method names, and user data may
remain untranslated. Panel-local UI copy must switch between English and Chinese.

${table(
  ["Group", "Panel", "EN evidence", "ZH evidence", "Status", "Notes"],
  panels.map((row) => [row.group, row.panel, "", "", "needs-capture", ""]),
)}
`;
}

function renderBackendGapAudit(rows) {
  const panels = [...new Map(rows.map((row) => [`${row.group}::${row.panel}`, row])).values()];
  return `# Backend Gap Audit

Generated: ${new Date().toISOString()}

Record old Node+Next behavior only when the Gateway/source of truth supports the
capability and the Go backend or adapter still lacks it.

${table(
  [
    "Group",
    "Panel",
    "Old workflow",
    "Gateway/source support",
    "Go gap",
    "Decision",
    "Verification",
  ],
  panels.map((row) => [row.group, row.panel, "", "", "", "needs-review", ""]),
)}
`;
}

function renderConsoleReview(rows) {
  return `# Console Review

Generated: ${new Date().toISOString()}

${table(
  ["ID", "Origin", "Console errors", "Page errors", "Network/auth notes", "Status"],
  rows.flatMap((row) => [
    [row.id, "old", "", "", "", "needs-capture"],
    [row.id, "current", "", "", "", "needs-capture"],
  ]),
)}
`;
}

function renderVerdictSummary(rows) {
  const panels = [...new Map(rows.map((row) => [`${row.group}::${row.panel}`, row])).values()];
  return `# Verdict Summary

Generated: ${new Date().toISOString()}

Current generated state: ${rows.length} rows need capture.

${table(
  [
    "Group",
    "Panel",
    "Pass",
    "Accepted exceptions",
    "Needs capture",
    "Needs fix",
    "Deferred",
    "Notes",
  ],
  panels.map((panel) => {
    const count = rows.filter(
      (row) => row.group === panel.group && row.panel === panel.panel,
    ).length;
    return [panel.group, panel.panel, "0", "0", String(count), "0", "0", ""];
  }),
)}
`;
}

function validate(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (ids.has(row.id)) {
      throw new Error(`duplicate row id: ${row.id}`);
    }
    ids.add(row.id);
    for (const key of ["group", "panel", "state", "oldAuthority", "currentTarget"]) {
      if (!row[key]) {
        throw new Error(`row ${row.id} missing ${key}`);
      }
    }
  }
  if (rows.length < 80) {
    throw new Error(`expected broad visual matrix, got only ${rows.length} rows`);
  }
}

function parseArgs(argv) {
  const args = { check: false, outDir: DEFAULT_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
    } else if (arg === "--out") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("--out requires a directory");
      }
      args.outDir = next;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function writeFiles(outDir, rows) {
  const files = new Map([
    ["screenshot-matrix.md", renderScreenshotMatrix(rows)],
    ["panel-authority-ledger.md", renderAuthorityLedger(rows)],
    ["interaction-audit.md", renderInteractionAudit(rows)],
    ["i18n-audit.md", renderI18nAudit(rows)],
    ["backend-gap-audit.md", renderBackendGapAudit(rows)],
    ["console-review.md", renderConsoleReview(rows)],
    ["verdict-summary.md", renderVerdictSummary(rows)],
  ]);
  fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(outDir, name), content);
  }
}

const args = parseArgs(process.argv.slice(2));
const rows = expandRows();
validate(rows);

if (!args.check) {
  writeFiles(args.outDir, rows);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      rows: rows.length,
      panels: new Set(rows.map((row) => `${row.group}::${row.panel}`)).size,
      outDir: args.outDir,
      wrote: !args.check,
    },
    null,
    2,
  ),
);
