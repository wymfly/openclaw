# Full Deck Visual Comparison Validation Plan

Updated: 2026-04-27

## Purpose

This plan defines the final visual comparison gate for the full Deck migration. It
uses the `deck-chat-visual-parity` validation standard as the baseline: each
accepted surface needs explicit old Deck reference evidence, current Vite/Go
evidence, console/error review, interaction coverage, i18n/theme coverage, and a
recorded verdict.

The previous four integration E2E closures proved that Core, Observe, Automate,
and Control panels can open against the Go backend plus managed Gateway stack.
They did not prove old Deck visual parity because they did not capture paired old
Next Deck screenshots and current Vite Deck screenshots.

## Browser Stacks

### Old Reference Stack

- App: old Next.js Deck under `dashboard/`.
- Start command: `NO_PROXY=localhost,127.0.0.1 pnpm --dir dashboard dev`.
- Browser route: old dashboard root.
- Panel selection: use the old dev-only `window.__TEST_UI_STORE__` hook when
  available, otherwise use old nav interactions.
- Locale: set `NEXT_LOCALE` cookie to `en` or `zh`, then reload.
- Theme: use old Shell/ThemeSync controls or local storage values when the UI
  control is not reachable.

### Current Target Stack

- App: `deck-go` Go backend serving the active Vite frontend bundle.
- Start command: `deck-go/scripts/manage-local-stack.sh start` or the foreground
  backend/frontend stack when live observation is needed.
- Gateway: managed source Gateway owned by the Go backend runtime API. Do not
  start global `openclaw`.
- Browser route: production-shaped Go backend static entry when available; Vite
  preview is acceptable only for panel-local debugging.
- Panel selection: route/query or `deckGoActivePanel` state, matching the current
  Deck UI shell behavior.
- Browser driver: Codex Playwright MCP/plugin only.

## Artifact Contract

All artifacts live under:

`.omx/artifacts/deck-full-visual-parity-comparison/`

Required files:

- `screenshot-matrix.md`:
  old artifact, current artifact, state, locale, theme, verdict, exception.
- `panel-authority-ledger.md`:
  old authority files, current target files, missing/accepted structures.
- `interaction-audit.md`:
  nav, tabs, dialogs, forms, menus, shortcuts, filters, actions, empty/loading/error states.
- `i18n-audit.md`:
  visible copy check for EN/ZH, with proper nouns and identifiers excluded.
- `backend-gap-audit.md`:
  old workflow, Gateway/source support, Go gap, decision, verification.
- `console-review.md`:
  console/page errors per stack and per route group.
- `verdict-summary.md`:
  final accepted/pass/fail/deferred classification per panel.

## Verdict Levels

- `pass`: old/current screenshots and interactions are perceptually equivalent
  for the required state, with only accepted non-pixel differences.
- `accepted-exception`: old screenshot cannot be captured or old behavior is not
  supported by the Gateway/source of truth; the row links to source-level
  authority and a rationale.
- `needs-fix`: visible layout, interaction, copy, iconography, state handling, or
  backend projection differs enough that parity cannot be claimed.
- `deferred`: non-blocking by explicit scope, currently only mobile parity or
  post-parity redesign.

## Required Coverage

Every row requires:

- old Next Deck screenshot or explicit per-state old-reference exception
- current Vite/Go screenshot
- console/page error review
- i18n mode where applicable
- theme mode where applicable
- source authority references
- current target references
- verdict and rationale

Sampling is not enough for final closure. The matrix must cover every active
desktop panel and at least one state for every materially different old Deck
subsurface.

## Matrix

### Shell And App Frame

| Surface            | Required states                                                                   |
| ------------------ | --------------------------------------------------------------------------------- |
| Shell frame        | expanded nav, collapsed nav, active panel header, gateway status, toast container |
| Keyboard shortcuts | shortcuts dialog open, keyboard shortcut changes active panel                     |
| Theme and locale   | EN/dark, EN/light, ZH/dark, ZH/light, no nav-only translation gaps                |
| Error/loading      | panel loading fallback, panel error boundary                                      |

### Chat

Reuse and refresh the existing `deck-chat-visual-parity` screenshot matrix:

- Empty Chat
- Active transcript with user and assistant messages
- Bash, diff, highlighted file/read, markdown/json/table/code/html renderers
- Approval pending dialog/state
- Right panel with canvas/A2UI
- Streaming/status banner
- Subagent lineage/card
- Transcript search/filter active
- Slash command palette
- Mention popover
- EN/ZH and light/dark states
- Live send evidence when credentials/config allow it

### Core

| Panel   | Required old/current states                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------- |
| Agents  | list/detail workspace, tabs, file/tools/skills views, compare mode, config editor, empty/error                |
| Gateway | overview, health/connection, live feed, history/timeline, run timeline/tool waterfall, unavailable-state rows |
| Models  | catalog, provider config, fallback chains, usage/quota, provider add/apply flow, empty/error                  |

### Observe

| Panel        | Required old/current states                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Usage        | summary cards, trend chart, date range, breakdown table, latency/context pressure, session usage |
| Sessions     | list/detail, turn timeline, transcript search, export, compaction history, context health/scope  |
| Memory       | file tree, search, knowledge graph, health diagnostics, dream diary/unavailable state            |
| Logs         | filters, stream viewport, pause/resume, export, loading/empty/error                              |
| Activity     | timeline, SSE status, filters, run detail/unavailable state, loading/empty/error                 |
| Threads      | list/detail, relation view, empty/error                                                          |
| API Explorer | method list/detail, schema viewer, event list, request/response, error feedback                  |

### Automate

| Panel          | Required old/current states                                                                |
| -------------- | ------------------------------------------------------------------------------------------ |
| Cron/Scheduler | job list, create/edit form, run history, run-now, next execution, heartbeat config         |
| Webhooks       | list, creation/edit form, delivery history, validation/error feedback                      |
| Approvals      | pending approvals, plugin approvals, policy editor, path allowlist, stream/action feedback |
| Skills         | list, hub, info, config, matrix, install/configure dialog, loading/empty/error             |

### Control

| Panel     | Required old/current states                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Budget    | status cards, rule list, create/edit form, validation/error                                              |
| Alerts    | rule list, fired alerts, create/edit form, validation/error                                              |
| Channels  | list/detail, settings, access, bindings, analytics, health/probe, onboarding/wizard/access descriptors   |
| Plugins   | list/detail, metadata, action state, unavailable actions                                                 |
| Routing   | binding table, condition builder, conflict badge, simulator, activity feed                               |
| Subagents | active runs, config, history, steer dialog, lineage/detail                                               |
| Identity  | list, link dialog, unlink/confirmation, empty/error                                                      |
| Config    | section navigation, schema form, field help, search/highlight, conflict dialog, diff preview             |
| Nodes     | node cards, pairing requests, lifecycle states, node actions                                             |
| Docs      | category filter, document list, document viewer, empty/error                                             |
| Settings  | about, appearance, connection, devices, notifications, pending requests, token rotation, confirm actions |

## Execution Sequence

1. Confirm both old and current stacks can be opened through Playwright MCP.
2. Capture Shell/App frame old/current screenshot pairs first.
3. Refresh Chat matrix or mark existing Chat artifacts as still valid with a
   date-stamped spot check.
4. Capture Core, Observe, Automate, and Control panel matrices group by group.
5. For each failed visual row, either fix immediately or record a `needs-fix`
   row with the owning panel and source/target file references.
6. Run EN/ZH and light/dark matrix after panel state screenshots so translation
   and token hierarchy are validated on the final implementation.
7. Run final Playwright MCP traversal against the Go backend plus managed
   Gateway stack.
8. Update `verdict-summary.md` and block final umbrella archive until every
   row is `pass`, `accepted-exception`, or `deferred` with an allowed reason.

## Completion Bar

The full visual migration is not complete until:

- every active desktop panel has old/current visual evidence
- every critical old subsurface has a row in `screenshot-matrix.md`
- every row has a verdict
- every `needs-fix` row has been fixed or split into a new blocking proposal
- all EN/ZH and light/dark checks pass for panel-local copy and hierarchy
- Playwright MCP final traversal is green
- the old/current comparison evidence is committed with the umbrella change
