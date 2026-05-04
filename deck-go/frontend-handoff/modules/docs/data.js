// Docs panel fixture — DeckGoDoc shape per deck-go/contracts/source/deck-api.contract.ts.
//
// Real contract is for *runtime-extracted documentation*: each doc is harvested
// from an agent session (sourceSession + sourceAgent provenance), classified
// into one of 5 categories (summary | plan | spec | manual | draft), and edited
// over time. The panel is a curated artifact reader, not a static doc site.
//
// 16 docs across 5 categories. Markdown content is concise samples; production
// fetches full content via GET /api/docs/{id}.

const NOW = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

// -- Categories (real DeckGoDocCategory enum) ----------------------------

const CATEGORIES = [
  {
    id: "summary",
    label: "Summaries",
    description: "Condensed recaps of long sessions or threads.",
  },
  {
    id: "plan",
    label: "Plans",
    description: "Forward-looking plans extracted from planning conversations.",
  },
  { id: "spec", label: "Specs", description: "Specifications and contract proposals." },
  { id: "manual", label: "Manuals", description: "Operational how-tos and runbooks." },
  { id: "draft", label: "Drafts", description: "Work-in-progress; not yet promoted." },
];

// -- Source agents / sessions referenced (for provenance display) --------

const AGENTS = {
  "agent-main": { name: "main", color: "#7aa2f7" },
  "agent-research": { name: "research", color: "#bb9af7" },
  "agent-ops": { name: "ops", color: "#f7768e" },
  "agent-spec": { name: "spec-writer", color: "#9ece6a" },
};

// -- Docs (DeckGoDoc shape, faithful to contract) ------------------------

const DOCS = [
  {
    id: "doc-summary-2026-05-04-arch",
    title: "Architecture overview — May 4 sync",
    category: "summary",
    sourceSession: "sess-2026-05-04-1100-main",
    sourceAgent: "agent-main",
    keywords: ["architecture", "bff", "supervisor", "gateway"],
    language: "en",
    extractedAt: iso(2 * DAY + 4 * HOUR),
    updatedAt: iso(2 * DAY),
    content: `# Architecture overview — May 4 sync

Three layers cooperate in deck-go:

1. **frontend-new (React/Vite)** — the panel surface. Calls the Go BFF, never the Gateway directly.
2. **deck-go backend (Go)** — the BFF. Translates HTTP routes into Gateway RPC calls; owns the supervisor in bundled mode.
3. **Gateway** — the OpenClaw control plane. Stays unaware of deck-go; speaks the typed RPC protocol.

## Bundled vs. remote

In **bundled mode**, the Go BFF spawns the Gateway as a child process and the panel reads its config from \`.env\`. In **remote mode**, the BFF connects to a Gateway over WebSocket and the panel can change connection params at runtime.

## Why split BFF from Gateway

The BFF owns *operator-mode* concerns: scope checks, audit, supervisor lifecycle. The Gateway stays a pure RPC server. This keeps Gateway portable across deck-go and other UIs.`,
  },
  {
    id: "doc-spec-agents-vs-sessions",
    title: "Agents vs. sessions — terminology",
    category: "spec",
    sourceSession: "sess-2026-05-02-1430-spec",
    sourceAgent: "agent-spec",
    keywords: ["agents", "sessions", "terminology"],
    language: "en",
    extractedAt: iso(5 * DAY + 2 * HOUR),
    updatedAt: iso(5 * DAY),
    content: `# Agents vs. sessions

Two often-confused concepts:

- **Agent** — a *configuration* (system prompt, tool grants, runtime policy). Persistent. Edited via the Agents panel.
- **Session** — a single *execution* of an agent against an input. Ephemeral. Listed in the Sessions panel.

The Agents panel is about *what can run*; the Sessions panel is about *what is running / what ran*.

## Lifecycle

\`\`\`
agent.create → agent.edit
            ↘
              agent.spawn → session created → session.run → session.completed
            ↗
agent.kill (admin scope)
\`\`\`

A session inherits its agent's policy snapshot at spawn time — later edits to the agent do not retroactively affect running sessions.`,
  },
  {
    id: "doc-spec-scope-model",
    title: "Scope model (read / write / admin)",
    category: "spec",
    sourceSession: "sess-2026-04-26-0915-spec",
    sourceAgent: "agent-spec",
    keywords: ["security", "scope", "rbac"],
    language: "en",
    extractedAt: iso(8 * DAY + 6 * HOUR),
    updatedAt: iso(8 * DAY),
    content: `# Scope model

Every Gateway method declares one of three required scopes:

| Scope | Methods | Audit |
|---|---|---|
| \`operator.read\` | \`*.list\`, \`*.detail\`, \`*.describe\` | none |
| \`operator.write\` | \`*.create\`, \`*.update\`, \`*.trigger\`, \`*.test\` | row written |
| \`operator.admin\` | \`*.delete\`, \`*.kill\`, \`*.scope.*\` | row + approval gate |

The deck-go session token carries an effective scope; the BFF rejects requests whose required scope exceeds the operator's grant. **Browser code never elevates scope** — that lives in the credential layer.

## Approval gates

Some \`operator.admin\` methods (e.g., \`deck.agents.kill\`) require an active approval before the BFF forwards the call. The Approvals panel shows the queue.`,
  },
  {
    id: "doc-manual-bundled-mode",
    title: "Bundled mode setup",
    category: "manual",
    sourceSession: "sess-2026-05-01-1645-ops",
    sourceAgent: "agent-ops",
    keywords: ["runtime", "bundled", "env", "setup"],
    language: "en",
    extractedAt: iso(3 * DAY + 1 * HOUR),
    updatedAt: iso(3 * DAY),
    content: `# Bundled mode setup

In bundled mode, deck-go spawns a Gateway child process at startup. All connection params come from \`.env\` — the UI is read-only for these fields.

## Required env

\`\`\`bash
RUNTIME_MODE=bundled
GATEWAY_BUNDLED_COMMAND=openclaw
GATEWAY_BUNDLED_ARGS=gateway run --bind loopback --port 18789
GATEWAY_BUNDLED_TOKEN=<shared-secret>
GATEWAY_BUNDLED_AUTOSTART=true
\`\`\`

## What the panel can / cannot do

- ✗ Change Gateway URL or token (read-only)
- ✓ View supervisor PID, restart policy, recent restarts
- ✓ Trigger a manual restart (admin scope)
- ✓ View Gateway describe output

See the remote-mode manual for the contrasting model.`,
  },
  {
    id: "doc-manual-remote-mode",
    title: "Remote mode setup",
    category: "manual",
    sourceSession: "sess-2026-05-01-1645-ops",
    sourceAgent: "agent-ops",
    keywords: ["runtime", "remote", "env", "setup"],
    language: "en",
    extractedAt: iso(3 * DAY),
    updatedAt: iso(3 * DAY - 2 * HOUR),
    content: `# Remote mode setup

Remote mode connects deck-go to a Gateway you manage separately (e.g., on a different host).

## Required env

\`\`\`bash
RUNTIME_MODE=remote
GATEWAY_REMOTE_URL=wss://gw.example.internal:8709/gateway
GATEWAY_REMOTE_TOKEN=<bearer-token>
GATEWAY_REMOTE_TLS_VERIFY=true
\`\`\`

## What the panel can do

- ✓ Edit Gateway URL / token / TLS verification (writes to JSON config, env stays default)
- ✓ View describe output, latency, last contact
- ✓ Reconnect on demand
- ✗ Spawn or restart Gateway (it's not ours to manage)`,
  },
  {
    id: "doc-spec-supervisor-lifecycle",
    title: "Supervisor lifecycle",
    category: "spec",
    sourceSession: "sess-2026-04-28-1100-research",
    sourceAgent: "agent-research",
    keywords: ["runtime", "supervisor", "bundled", "process"],
    language: "en",
    extractedAt: iso(6 * DAY + 8 * HOUR),
    updatedAt: iso(6 * DAY),
    content: `# Supervisor lifecycle

Bundled mode runs a supervisor goroutine that owns the Gateway child process. Five behaviors matter:

1. **PID adoption** — on startup, if a Gateway is already running on the configured port and our \`fingerprint.json\` matches, adopt it instead of spawning fresh
2. **Fingerprinting** — write a \`fingerprint.json\` next to the PID file so re-adoption is safe across restarts
3. **Ownership** — only the supervisor that *spawned* the process can kill it; adopted processes get \`kind: "adopted"\` and require explicit user confirmation
4. **Restart-on-crash** — exponential backoff (1s, 2s, 4s, max 30s) up to 10 attempts within 5 minutes
5. **Graceful shutdown** — SIGTERM → 5s grace → SIGKILL`,
  },
  {
    id: "doc-spec-dto-authority",
    title: "DTO authority chain",
    category: "spec",
    sourceSession: "sess-2026-05-03-1530-spec",
    sourceAgent: "agent-spec",
    keywords: ["contracts", "codegen", "dto"],
    language: "en",
    extractedAt: iso(1 * DAY + 4 * HOUR),
    updatedAt: iso(1 * DAY),
    content: `# DTO authority chain

The single source of truth for all deck-go DTOs is \`deck-go/contracts/source/deck-api.contract.ts\`. Two artifacts are generated from it:

- \`deck-go/backend/internal/deckapi/types.generated.go\` (Go structs)
- \`deck-go/contracts/generated/ts/deck-api.generated.ts\` (TS types for frontend)

## Workflow

1. Edit \`source/deck-api.contract.ts\`
2. Run \`cd deck-go && make contracts-sync\`
3. Both generated files update + \`.sha256\` checksum file
4. \`make contract-gate\` verifies no drift

## Adding a new DTO

\`\`\`ts
export type DeckGoFooBar = {
  id: string;
  // ...
};
\`\`\`

Then run sync. Don't hand-edit the generated files — they're committed for diff visibility but treated as build artifacts.`,
  },
  {
    id: "doc-summary-protocol-pipeline",
    title: "Gateway protocol generation — Apr 30 review",
    category: "summary",
    sourceSession: "sess-2026-04-30-1000-research",
    sourceAgent: "agent-research",
    keywords: ["contracts", "protocol", "gateway", "codegen"],
    language: "en",
    extractedAt: iso(4 * DAY + 6 * HOUR),
    updatedAt: iso(4 * DAY),
    content: `# Gateway protocol generation

The OpenClaw Gateway exposes a typed RPC protocol; deck-go consumes it through a generated TS client (legacy: \`dashboard/\`; deck-go uses its own contract chain).

For deck-go specifically, the relevant pipeline is:

\`\`\`
contracts/source/deck-api.contract.ts (TS DTOs)
  → make contracts-sync
  → contracts/generated/ts/deck-api.generated.ts
  → contracts/generated/go/deckapi/types.generated.go
\`\`\`

Plus the BFF route registry:

\`\`\`
backend/internal/server/routes.go (canonical route table)
  → describe RPC for runtime introspection
\`\`\`

## Drift gate

\`make contract-gate\` exits non-zero if generated files are out of sync with their source. CI blocks merge.`,
  },
  {
    id: "doc-spec-breaking-changes",
    title: "Breaking-change guidance",
    category: "spec",
    sourceSession: "sess-2026-04-23-0945-spec",
    sourceAgent: "agent-spec",
    keywords: ["contracts", "policy", "breaking-change"],
    language: "en",
    extractedAt: iso(11 * DAY + 3 * HOUR),
    updatedAt: iso(11 * DAY),
    content: `# Breaking-change guidance

Two failure modes to avoid:

1. Renaming a field — silently breaks every existing consumer
2. Tightening a field's type (e.g., string → string-with-enum) — breaks consumers passing values that used to be valid

## Safe additive changes

- Add a new optional field
- Loosen a type (string → string | null)
- Add a new method
- Add a new value to an enum *and* document UI fallback for older clients

## Deprecation flow

\`\`\`
add new field as optional
  → migrate consumers over time
  → 2 release cycles later, mark old field deprecated
  → 2 more cycles, remove
\`\`\`

Communicate every step in the changelog. Drift gate catches the codegen but not the semantic intent — that's a human gate.`,
  },
  {
    id: "doc-manual-add-endpoint",
    title: "Add a new BFF endpoint",
    category: "manual",
    sourceSession: "sess-2026-05-02-0830-ops",
    sourceAgent: "agent-ops",
    keywords: ["howto", "endpoints", "bff"],
    language: "en",
    extractedAt: iso(2 * DAY + 9 * HOUR),
    updatedAt: iso(2 * DAY + 1 * HOUR),
    content: `# How to add a new BFF endpoint

1. **Add the DTO** in \`contracts/source/deck-api.contract.ts\`:
   \`\`\`ts
   export type DeckGoFooListResponse = { items: DeckGoFoo[] };
   \`\`\`
2. **Run \`make contracts-sync\`** — generates Go + TS counterparts
3. **Add the handler** in \`backend/internal/server/foo.go\`:
   \`\`\`go
   func (s *Server) ListFoos(c echo.Context) error {
     // ...
     return c.JSON(200, DeckGoFooListResponse{Items: items})
   }
   \`\`\`
4. **Register the route** in \`backend/internal/server/routes.go\`
5. **Add the frontend wrapper** in \`frontend-new/src/api/foo.ts\`:
   \`\`\`ts
   export const fetchFoos = () => apiGet<DeckGoFooListResponse>("/api/foos");
   \`\`\`
6. **Run \`make contract-gate\`** before commit`,
  },
  {
    id: "doc-manual-test-webhook",
    title: "Test a webhook delivery",
    category: "manual",
    sourceSession: "sess-2026-05-03-1700-ops",
    sourceAgent: "agent-ops",
    keywords: ["howto", "webhooks", "delivery"],
    language: "en",
    extractedAt: iso(1 * DAY + 6 * HOUR),
    updatedAt: iso(1 * DAY + 30 * 60_000),
    content: `# How to test a webhook delivery

Three options:

## 1. Webhooks panel (recommended)

Open Webhooks → select the receiver → click **Test delivery** in the actions row. The panel shows phase ladder (running → done/error) and prepends the new delivery to the table.

## 2. API Explorer

Open API Explorer → \`deck.webhooks.test\` → fill in \`webhookId\` → Run. Same result, with full request/response visible.

## 3. CLI (coming)

\`\`\`bash
openclaw deck webhooks test --id wh-ops-slack --event alert.fired
\`\`\`

In all three cases, the receiver gets a fully-formed POST with the same headers (\`X-Deck-Signature\` HMAC if a secret is set, \`Content-Type: application/json\`). It can't tell a test delivery from a real one — that's the point.`,
  },
  {
    id: "doc-plan-upgrade-deck-go",
    title: "deck-go upgrade plan — v0.6.0",
    category: "plan",
    sourceSession: "sess-2026-04-27-1115-ops",
    sourceAgent: "agent-ops",
    keywords: ["howto", "release", "upgrade"],
    language: "en",
    extractedAt: iso(7 * DAY + 5 * HOUR),
    updatedAt: iso(7 * DAY),
    content: `# How to upgrade deck-go

## Prerequisites

- Read the changelog for breaking changes
- Verify your environment matches the new version's runtime requirements (Node >= 22.14, Go >= 1.24)
- Snapshot \`localstore.db\` if upgrading across a schema migration

## Steps

\`\`\`bash
# 1. Pull
git fetch origin
git checkout v0.6.0

# 2. Install
pnpm install

# 3. Build
cd deck-go && make build-all

# 4. Run contract gate
make contract-gate

# 5. Restart
make restart-bundled  # or remote
\`\`\`

## Rollback

Migrations are forward-only. If you need to roll back, restore the snapshot from step 0.`,
  },
  {
    id: "doc-spec-approval-policy",
    title: "Approval policy schema",
    category: "spec",
    sourceSession: "sess-2026-04-28-1530-spec",
    sourceAgent: "agent-spec",
    keywords: ["approvals", "security", "policy"],
    language: "en",
    extractedAt: iso(6 * DAY + 11 * HOUR),
    updatedAt: iso(6 * DAY),
    content: `# How to configure an approval policy

Approvals panel → click **Edit policy**.

A policy has:
- **Method match** — full method name or prefix (e.g., \`deck.agents.*\`)
- **Required reviewers** — minimum count + role filter
- **Expiry** — auto-reject if no decision within N minutes
- **Auto-approve allowlist** — bypass gating for specific operators

## Example: kill requires 2 admins

\`\`\`json
{
  "match": "deck.agents.kill",
  "minReviewers": 2,
  "reviewerRoles": ["admin"],
  "expiryMinutes": 15
}
\`\`\`

Save → effective immediately. New \`deck.agents.kill\` requests pause until 2 admins click Approve in the queue.`,
  },
  {
    id: "doc-summary-event-bus",
    title: "Event bus and subscriptions — research notes",
    category: "summary",
    sourceSession: "sess-2026-04-25-1430-research",
    sourceAgent: "agent-research",
    keywords: ["events", "webhooks", "alerts", "activity"],
    language: "en",
    extractedAt: iso(9 * DAY + 7 * HOUR),
    updatedAt: iso(9 * DAY),
    content: `# Event bus

Every operator action and runtime change emits an event onto a single in-process bus. Three subscribers consume from it:

| Subscriber | What it does |
|---|---|
| Activity feed | Renders the event in the UI |
| Webhook dispatcher | Looks up matching receivers, fires HTTP POST |
| Alert engine | Evaluates rules, fires alerts when conditions match |

## Catalog

\`approval.pending\`, \`approval.resolved\`, \`channel.connected\`, \`channel.disconnected\`, \`channel.message\`, \`cron.run\`, \`cron.run.error\`, \`session.created\`, \`session.closed\`, \`alert.fired\`, \`alert.cleared\`, \`agent.heartbeat\`, \`agent.error\`, \`deploy.started\`, \`deploy.finished\`, \`memory.added\`, \`monitor.snapshot\`, \`plugin.activated\`, \`plugin.deactivated\`.

This list is also visible in the Webhooks builder's event-picker grid.`,
  },
  {
    id: "doc-manual-local-dev",
    title: "Local dev workflow",
    category: "manual",
    sourceSession: "sess-2026-04-30-0930-ops",
    sourceAgent: "agent-ops",
    keywords: ["runtime", "dev", "hmr"],
    language: "en",
    extractedAt: iso(4 * DAY + 4 * HOUR),
    updatedAt: iso(4 * DAY),
    content: `# Local dev workflow

The fast loop:

\`\`\`bash
# Terminal 1 — BFF + Gateway (bundled)
cd deck-go && ./scripts/dev/run-bundled.sh

# Terminal 2 — frontend with HMR
cd deck-go/frontend-new && pnpm dev
\`\`\`

frontend-new proxies \`/api/*\` to the BFF on \`:8788\`. Edits in \`frontend-new/src/\` hot-reload; edits in \`backend/\` require a BFF restart.

## Real Gateway (no bundled spawn)

\`\`\`bash
./scripts/dev/run-stack-real.sh
\`\`\`

Useful when debugging supervisor adoption or fingerprinting behavior.`,
  },
  {
    id: "doc-draft-flaky-channel",
    title: "Diagnose a flaky channel — draft",
    category: "draft",
    sourceSession: "sess-2026-05-04-0815-ops",
    sourceAgent: "agent-ops",
    keywords: ["howto", "channels", "debugging"],
    language: "en",
    extractedAt: iso(2 * HOUR),
    updatedAt: iso(30 * 60_000),
    content: `# How to diagnose a flaky channel

In order, fastest checks first:

## 1. Channels panel — last-status column

If it shows \`reconnecting\` repeatedly, the channel layer is doing its job. Move to step 2.

## 2. Recent disconnect timeline

Click the channel → Timeline tab. Look for clusters of \`channel.disconnected\` followed quickly by \`channel.connected\`. That's flapping.

## 3. Network conditions

\`curl -w "%{time_total}\\n" -o /dev/null -s <provider-endpoint>\` from the BFF host. Latency > 2s often correlates with flapping.

## 4. Auth token expiry

Some providers issue short-lived tokens. Check \`channel.error\` events in Activity for \`auth\` substrings.

## 5. Rate limits

Look for \`429\` or \`rate_limit\` in the channel's error log (per-channel detail tab).

## 6. Provider status page

Last resort but often the answer. Most channel flapping correlates with provider incidents.

> _DRAFT_ — needs verification of step 3 timing thresholds before promotion.`,
  },
];

// Active session candidate for the Extract CTA (stub — production reads from
// session store).

const ACTIVE_SESSION = {
  id: "sess-2026-05-04-1330-main",
  agentId: "agent-main",
  agentName: "main",
  startedAt: iso(45 * 60_000),
  messageCount: 28,
};

const BOOTSTRAP = { ok: true, runtimeVersion: "0.5.0" };

Object.assign(window, { CATEGORIES, AGENTS, DOCS, ACTIVE_SESSION, BOOTSTRAP });
