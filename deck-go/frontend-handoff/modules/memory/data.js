// Memory panel fixture — DeckGo memory DTOs per
// deck-go/contracts/source/deck-api.contract.ts:1623-1705.
//
// Real surface is a 4-tab control plane:
// 1. Browse — file-system tree (DeckGoMemoryBrowseResponse)
// 2. Search — semantic search (DeckGoMemorySearchResponse)
// 3. Health — per-agent embedding status (DeckGoMemoryHealthResponse)
// 4. Dreams — dream-diary read + maintenance actions (DeckGoMemoryDreamsResult)

const NOW = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const msAgo = (ms) => NOW - ms;

// -- Agents (for scoping the views) --------------------------------------

const AGENTS = [
  { id: "main", name: "main", color: "#7aa2f7" },
  { id: "research", name: "research", color: "#bb9af7" },
  { id: "ops", name: "ops", color: "#f7768e" },
  { id: "spec-writer", name: "spec-writer", color: "#9ece6a" },
];

// -- Browse: DeckGoMemoryBrowseResponse + DeckGoMemoryFileNode -----------

const BROWSE_TREE = {
  "/": [
    { name: "global", path: "/global", type: "directory" },
    { name: "agents", path: "/agents", type: "directory" },
    { name: "session-corpus", path: "/session-corpus", type: "directory" },
    { name: "MEMORY.md", path: "/MEMORY.md", type: "file", size: 4_120 },
  ],
  "/global": [
    { name: "user_preferences.md", path: "/global/user_preferences.md", type: "file", size: 2_340 },
    {
      name: "feedback_test_strategy.md",
      path: "/global/feedback_test_strategy.md",
      type: "file",
      size: 1_890,
    },
    {
      name: "project_runtime_decoupling.md",
      path: "/global/project_runtime_decoupling.md",
      type: "file",
      size: 3_650,
    },
    {
      name: "reference_dashboards.md",
      path: "/global/reference_dashboards.md",
      type: "file",
      size: 870,
    },
  ],
  "/agents": [
    { name: "main", path: "/agents/main", type: "directory" },
    { name: "research", path: "/agents/research", type: "directory" },
    { name: "ops", path: "/agents/ops", type: "directory" },
    { name: "spec-writer", path: "/agents/spec-writer", type: "directory" },
  ],
  "/agents/main": [
    { name: "core.md", path: "/agents/main/core.md", type: "file", size: 6_120 },
    { name: "working.md", path: "/agents/main/working.md", type: "file", size: 12_400 },
    { name: "peripheral.md", path: "/agents/main/peripheral.md", type: "file", size: 18_700 },
    { name: "dreams.diary.md", path: "/agents/main/dreams.diary.md", type: "file", size: 4_200 },
  ],
  "/agents/research": [
    { name: "core.md", path: "/agents/research/core.md", type: "file", size: 4_300 },
    { name: "working.md", path: "/agents/research/working.md", type: "file", size: 9_800 },
    { name: "peripheral.md", path: "/agents/research/peripheral.md", type: "file", size: 22_100 },
  ],
  "/agents/ops": [
    { name: "core.md", path: "/agents/ops/core.md", type: "file", size: 3_900 },
    { name: "working.md", path: "/agents/ops/working.md", type: "file", size: 7_200 },
    { name: "peripheral.md", path: "/agents/ops/peripheral.md", type: "file", size: 14_500 },
  ],
  "/agents/spec-writer": [
    { name: "core.md", path: "/agents/spec-writer/core.md", type: "file", size: 5_100 },
    { name: "working.md", path: "/agents/spec-writer/working.md", type: "file", size: 8_900 },
  ],
  "/session-corpus": [
    { name: "2026-05-04.md", path: "/session-corpus/2026-05-04.md", type: "file", size: 2_100 },
    { name: "2026-05-03.md", path: "/session-corpus/2026-05-03.md", type: "file", size: 4_700 },
    { name: "2026-05-02.md", path: "/session-corpus/2026-05-02.md", type: "file", size: 3_800 },
  ],
};

const FILE_CONTENTS = {
  "/MEMORY.md": `# Memory Index

This is the canonical entry point. Each line points to a file under \`global/\` or \`agents/\`.

- [user_preferences.md](global/user_preferences.md) — operator preferences (terse responses, dark mode, etc.)
- [feedback_test_strategy.md](global/feedback_test_strategy.md) — keep tests integration-flavored
- [project_runtime_decoupling.md](global/project_runtime_decoupling.md) — the runtime-mode decoupling change
- [reference_dashboards.md](global/reference_dashboards.md) — Grafana dashboard map

## Per-agent

- [main/core.md](agents/main/core.md)
- [research/core.md](agents/research/core.md)
- [ops/core.md](agents/ops/core.md)
- [spec-writer/core.md](agents/spec-writer/core.md)
`,
  "/global/user_preferences.md": `---
name: user_preferences
type: user
description: Operator's preferences for terse responses, dark mode, and parallel agents.
---

The operator prefers:
- Terse responses with no trailing summaries (the diff is enough)
- Dark mode by default
- Parallel agent runs when independent
- Chinese (zh) for casual conversation; English (en) for code review notes
- Concrete file paths over abstract descriptions when pointing at code

Last validated: 2026-04-28 — operator confirmed the same preferences after the
"feedback_quality_over_speed" memory was added.
`,
  "/global/feedback_test_strategy.md": `---
name: feedback_test_strategy
type: feedback
description: Integration tests over mocks; never mock the database.
---

**Rule:** integration tests MUST hit a real database (or test container), never
mocks.

**Why:** Q1 incident where mocked tests passed but the prod migration failed.
The mock and prod diverged on a CHECK constraint that the mock layer did not
enforce; tests stayed green for ~6 weeks before the migration day.

**How to apply:** for any test against a function that opens a database
transaction, set up a real test container or hit the local Postgres/SQLite.
Mocking the surrounding service is fine — mocking the storage layer is not.
`,
  "/global/project_runtime_decoupling.md": `---
name: project_runtime_decoupling
type: project
description: The runtime-mode decoupling change is in flight.
---

Status: tasks 1-9 done; final manual browser smoke + archive remaining.

Why: bundled vs. remote modes share too many fields; UI mutates state that the
supervisor owns. Decoupling lets bundled mode be read-only in the UI (env-driven)
and remote mode be UI-editable (writes to JSON config that overrides env).

How to apply: when reading a setting, always check whether RUNTIME_MODE makes
this field read-only — if yes, render as muted with a "(env-driven)" hint.
`,
  "/global/reference_dashboards.md": `---
name: reference_dashboards
type: reference
description: Pointers to the Grafana dashboards the oncall watches.
---

- grafana.internal/d/api-latency — request-path p99 / p999 (oncall pages on this)
- grafana.internal/d/runtime-supervisor — child process restarts
- grafana.internal/d/contracts-drift — generated-vs-source drift counter

When editing request-path code, check the api-latency board before merging.
`,
  "/agents/main/core.md": `# main · core memories

Core tier — never decays. Loaded into every prompt.

## Identity
- The operator is a senior engineer working on deck-go (operator-mode platform on top of OpenClaw Gateway).
- Responses should be terse, avoid summarizing what was just done.

## Style
- File references are repo-relative (e.g., \`src/foo.ts:42\`), never absolute.
- American English spelling.
- Code commits via \`scripts/committer\`, never raw \`git commit\`.

## Project state
- deck-go is the current mainline; \`dashboard/\` is legacy.
- runtime-mode-decoupling change is the current focus.
`,
  "/agents/main/working.md": `# main · working memories

Working tier — short-decay. Refreshed each session start.

## In-flight
- runtime-mode-decoupling tasks 1-9 done; manual browser smoke + archive remaining
- docs panel v2 prototype just landed

## Recent decisions
- 2026-05-04: Locked react-markdown + remark-gfm + rehype-highlight for production docs
- 2026-05-03: Locked CodeMirror 6 for api-explorer code editor
- 2026-05-02: Promoted StatusCodeBadge from webhooks to api-explorer (second use)

## Last session highlights
- Built docs prototype with provenance row + extract popover + delete confirm
- Reconciled DeckGoDoc contract (PRD invented DTOs that don't exist)
`,
  "/agents/main/peripheral.md": `# main · peripheral memories

Peripheral tier — long-decay. Pruned by the dream cycle.

## Old patterns
(20+ entries about rejected designs, dead ends, etc. Truncated for prototype.)
`,
  "/agents/main/dreams.diary.md": `# Dreams diary — main agent

A consolidated reflection log written by the dream cycle. Read-only from the UI.

## 2026-05-04 cycle
- Consolidated 14 working-tier entries into 3 core-tier rules
- Pruned 8 peripheral entries that hadn't been touched in 30+ days
- Detected and merged 2 duplicate "user prefers terse" memories
- Total entries: 142 (was 156); core: 11 (was 9); working: 24 (was 38); peripheral: 107 (was 109)

## 2026-05-03 cycle
- No consolidation candidates; corpus stable
- Pruned 3 peripheral entries

## 2026-05-02 cycle
- Promoted "feedback_quality_over_speed" from working to core (3rd validation across sessions)
`,
  "/agents/research/core.md": `# research · core memories

## Identity
Research agent. Reads aggressively, writes carefully. Always cites primary sources.

## Style
- Quotations include line ranges from source files.
- Web fetches go through Context Hub MCP first; web search is fallback.
`,
  "/agents/ops/core.md": `# ops · core memories

## Identity
Ops agent. Owns deployment, monitoring, incident response.

## Tools
- Always use \`scripts/dev/run-bundled.sh\` for the bundled stack.
- Verify changes with \`make verify\` before merge.
`,
  "/agents/spec-writer/core.md": `# spec-writer · core memories

## Identity
Spec-writer. Outputs proposals, design docs, and acceptance criteria.

## Style
- Specs use the OpenSpec workflow (proposal → design → tasks → spec).
- Acceptance criteria are concrete and testable; no "implementation is complete" boilerplate.
`,
  "/session-corpus/2026-05-04.md": `# Session corpus — 2026-05-04

Aggregated session messages from 2026-05-04 used as input to the dream cycle.
~12 sessions, ~280 messages.

(Truncated for prototype.)
`,
  "/session-corpus/2026-05-03.md": `# Session corpus — 2026-05-03

~8 sessions, ~190 messages.

(Truncated for prototype.)
`,
  "/session-corpus/2026-05-02.md": `# Session corpus — 2026-05-02

~10 sessions, ~240 messages.

(Truncated for prototype.)
`,
};

// -- Health: DeckGoMemoryHealthResponse + DeckGoMemoryHealthEntry --------

const HEALTH = {
  lanceDbEnabled: true,
  entries: [
    { agentId: "main", provider: "openai/text-embedding-3-large", embeddingStatus: "ok" },
    { agentId: "research", provider: "openai/text-embedding-3-large", embeddingStatus: "ok" },
    { agentId: "ops", provider: "openai/text-embedding-3-large", embeddingStatus: "ok" },
    {
      agentId: "spec-writer",
      provider: "anthropic/voyage-3",
      embeddingStatus: "error",
      error: "rate limit exceeded — retry in 30s",
    },
  ],
};

// -- Search: DeckGoMemorySearchResponse + DeckGoMemorySearchResult -------

const SEARCH_FIXTURES = {
  "runtime mode": {
    results: [
      {
        path: "/global/project_runtime_decoupling.md",
        content:
          "Status: tasks 1-9 done; final manual browser smoke + archive remaining. Why: bundled vs. remote modes share too many fields; UI mutates state that the supervisor owns.",
        relevance: 0.94,
        tier: "core",
        scope: "global",
        decayScore: 0.02,
      },
      {
        path: "/agents/main/working.md",
        content:
          "## In-flight: runtime-mode-decoupling tasks 1-9 done; manual browser smoke + archive remaining",
        relevance: 0.86,
        tier: "working",
        scope: "agent:main",
        decayScore: 0.31,
      },
      {
        path: "/agents/ops/core.md",
        content: "Always use scripts/dev/run-bundled.sh for the bundled stack.",
        relevance: 0.62,
        tier: "core",
        scope: "agent:ops",
        decayScore: 0.05,
      },
    ],
    unavailableReason: null,
    lanceDbEnabled: true,
  },
  "test strategy": {
    results: [
      {
        path: "/global/feedback_test_strategy.md",
        content:
          "Rule: integration tests MUST hit a real database (or test container), never mocks. Why: Q1 incident where mocked tests passed but the prod migration failed.",
        relevance: 0.97,
        tier: "core",
        scope: "global",
        decayScore: 0.01,
      },
      {
        path: "/agents/ops/core.md",
        content: "Verify changes with make verify before merge.",
        relevance: 0.51,
        tier: "core",
        scope: "agent:ops",
        decayScore: 0.05,
      },
    ],
    unavailableReason: null,
    lanceDbEnabled: true,
  },
  dashboard: {
    results: [
      {
        path: "/global/reference_dashboards.md",
        content: "grafana.internal/d/api-latency — request-path p99 / p999 (oncall pages on this)",
        relevance: 0.91,
        tier: "core",
        scope: "global",
        decayScore: 0.04,
      },
    ],
    unavailableReason: null,
    lanceDbEnabled: true,
  },
};

// -- Dreams: DeckGoMemoryDreamsResult ------------------------------------

const DREAMS = {
  // DeckGoMemoryDreamDiaryResult per agent
  diaries: {
    main: {
      agentId: "main",
      found: true,
      path: "/agents/main/dreams.diary.md",
      content: FILE_CONTENTS["/agents/main/dreams.diary.md"],
      updatedAtMs: msAgo(2 * HOUR),
    },
    research: {
      agentId: "research",
      found: true,
      path: "/agents/research/dreams.diary.md",
      content: `# Dreams diary — research agent\n\n## 2026-05-04 cycle\n- Consolidated 8 working-tier entries\n- Pruned 5 peripheral entries\n`,
      updatedAtMs: msAgo(8 * HOUR),
    },
    ops: {
      agentId: "ops",
      found: false,
      path: "/agents/ops/dreams.diary.md",
    },
    "spec-writer": {
      agentId: "spec-writer",
      found: true,
      path: "/agents/spec-writer/dreams.diary.md",
      content: `# Dreams diary — spec-writer\n\n## 2026-05-04 cycle\n- No consolidation; corpus stable\n`,
      updatedAtMs: msAgo(1 * DAY + 4 * HOUR),
    },
  },
  // Last action result, keyed by action name
  lastActions: {},
};

const BOOTSTRAP = { ok: true, runtimeVersion: "0.5.0" };

Object.assign(window, {
  AGENTS,
  BROWSE_TREE,
  FILE_CONTENTS,
  HEALTH,
  SEARCH_FIXTURES,
  DREAMS,
  BOOTSTRAP,
});
