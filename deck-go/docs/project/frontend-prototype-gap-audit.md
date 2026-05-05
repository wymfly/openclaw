# Frontend Prototype Gap Audit

**Date**: 2026-05-05
**Scope**: `frontend-handoff/modules/*/prototype.html` versus `frontend-new` rendered pages
**Status**: working audit record for follow-up correction proposals
**Governing remediation**: `openspec/changes/deck-go-frontend-prototype-parity-remediation`

This document records the current visual and workflow gaps found while comparing
the high-fidelity handoff prototypes with the real `frontend-new` implementation.
It is an evidence log, not a source of truth. The source of truth remains code,
contracts, generated artifacts, and current test output.

The remediation matrix that tracks module-by-module follow-up work is
`deck-go/docs/project/frontend-prototype-remediation-matrix.md`.

## Evidence Captured

Real-stack normalized comparison artifacts were generated under:

- `deck-go/.local/prototype-gap-audit/index.html`
- `deck-go/.local/prototype-gap-audit/results.json`
- `deck-go/.local/prototype-gap-audit/sheet-1.png` through `sheet-6.png`
- `deck-go/.local/prototype-gap-audit/<module>--prototype.png`
- `deck-go/.local/prototype-gap-audit/<module>--current-dark.png`

The current pages were captured with:

- frontend dev server: `http://127.0.0.1:4174`
- backend: `http://127.0.0.1:19566`
- Gateway: `ws://127.0.0.1:18789`
- locale normalized to `en`
- theme normalized to `dark`
- navigation normalized to expanded state

Important limitation: many real-stack pages were empty or degraded because the
real Gateway/workspace was not seeded with module-rich data. Those empty states
are still useful evidence for real E2E readiness, but they must not be confused
with mock visual parity evidence.

Mock visual evidence from the follow-up audit was generated under:

- `deck-go/.local/mock-visual-run/`
- `deck-go/.local/mock-prototype-audit/index.html`
- `deck-go/.local/mock-prototype-audit/sheet-1.png` through `sheet-6.png`
- `deck-go/.local/mock-prototype-audit/pixel-diff.json`

The mock run command was:

```bash
cd deck-go
pnpm exec playwright test test/e2e/*-visual.spec.ts \
  --config playwright.config.ts \
  --output .local/mock-visual-run \
  --reporter=line
```

Result: 27 tests ran, 24 passed, 3 failed. The failures happened before their
primary screenshots were saved, so those modules do not currently have mock
visual parity evidence.

Historical module proposals that only captured screenshots are superseded by the
new remediation workflow. Their evidence remains useful as mock functional or
screenshot evidence, but it is not treated as prototype parity evidence unless a
side-by-side comparison and verdict are present.

## Overall Finding

The current implementation is not visually aligned with the handoff prototypes
across most modules. The gap is not primarily a single CSS or theme bug. The
larger cause is process drift:

- module OpenSpec passes often accepted contract wiring, smoke tests, or mock
  screenshots as enough evidence;
- the mock visual tests save screenshots but do not compare them against
  prototypes or approved baselines;
- several implementation passes explicitly did not rewrite production UI to the
  new prototype shape;
- real-stack visual validation was deferred or circuit-broken, leaving empty and
  error states uncorrected;
- global shell/theme/locale defaults were not normalized to the prototype target
  during normal app startup.

## Module Gap Matrix

| Module       |       Observed gap | Notes for correction                                                                                                                                                                                                                                          |
| ------------ | -----------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity     |               High | Prototype is a flat operational timeline with dense event rows and inspectable details. Current real page lands in a three-column shell with sparse/empty state. Needs a prototype-led rewrite or a documented decision that the shell pattern is the target. |
| Agents       |               High | Prototype emphasizes compact enterprise agent inventory and status scanning. Current page is KPI-heavy and form/detail oriented, so hierarchy, density, and task flow diverge.                                                                                |
| Alerts       |               High | Prototype presents rule rows, delivery state, severity, and response affordances. Current page is mostly empty local-rule scaffolding.                                                                                                                        |
| API Explorer |             Medium | Same broad multi-pane concept exists, but spacing, control hierarchy, request/response treatment, and details do not match the handoff artifact closely.                                                                                                      |
| Approvals    |               High | Prototype has a decision queue with urgency and action context. Current page is an empty inbox/detail shell.                                                                                                                                                  |
| Budget       |               High | Prototype presents budget policy, thresholds, and metering. Current real page shows empty inventory and does not communicate the designed state.                                                                                                              |
| Channels     |               High | Prototype targets a full-width list-to-detail workflow. Current implementation remains closer to an older two-column workbench and is empty in real-stack capture.                                                                                            |
| Chat         | High in real-stack | Prototype has a populated transcript, composer, and adjacent operational context. Current real capture shows an empty/new session state. This may be partly seed-related, but real visual readiness is not proven.                                            |
| Config       |               High | Prototype presents curated configuration sections and guided editing. Current page exposes raw-ish config/schema navigation and chip-heavy structure.                                                                                                         |
| Cron         |               High | Prototype shows scheduled job list, run history, and controls. Current real page is empty job scaffolding.                                                                                                                                                    |
| Docs         |               High | Prototype has a documentation tree and article reading surface. Current real page is empty or low-information.                                                                                                                                                |
| Gateway      |         Low/Medium | Closest non-chat module. Current page and prototype share health/overview concepts, but density and exact card hierarchy still differ.                                                                                                                        |
| Identity     |               High | Prototype focuses on canonicals, peers, and identity relationships. Current page is mostly empty in real capture.                                                                                                                                             |
| Logs         |         Low/Medium | Current page is relatively close in broad purpose, but raw JSON/noisy presentation and hierarchy differ from the designed log review surface.                                                                                                                 |
| Memory       |        Medium/High | Prototype shows selected memory/document detail. Current page is more tree plus empty preview oriented.                                                                                                                                                       |
| Models       |               High | Prototype is a model inventory/capability table. Current page behaves more like a config workbench.                                                                                                                                                           |
| Nodes        |               High | Prototype presents node operations and health. Current real page is empty.                                                                                                                                                                                    |
| Plugins      |        Medium/High | Prototype is a table/list with deployment and status emphasis. Current page uses a two-pane detail shape and diverges in density.                                                                                                                             |
| Routing      |        Medium/High | Concepts overlap, but current page is form/empty-state heavy and does not match prototype hierarchy.                                                                                                                                                          |
| Sessions     |           Critical | Current real page hits the error boundary. `SessionUsageDetails` assumes non-null context-weight entries while the real API can return `entries: null`. This is a functional blocker, not just visual drift.                                                  |
| Settings     |               High | Prototype is a full settings dashboard with grouped product controls. Current page uses section navigation and does not match the visual target.                                                                                                              |
| Skills       |        Medium/High | Prototype is table-first and inventory oriented. Current page is a two-pane list/detail implementation.                                                                                                                                                       |
| Subagents    |               High | Prototype shows live run/subagent operating table. Current real page is empty.                                                                                                                                                                                |
| Threads      |               High | Prototype shows bindings and thread relationships. Current real page is empty.                                                                                                                                                                                |
| Usage        |        Medium/High | Prototype includes richer charts, quota/status hierarchy, and summary cards. Current page is weaker and sparse with real data.                                                                                                                                |
| Webhooks     |               High | Prototype shows receiver inventory and delivery state. Current real page is empty.                                                                                                                                                                            |

## Code And Process Findings

### App Shell And Defaults

The current real pages are always rendered through the app shell and module
registry:

- `deck-go/frontend-new/src/deck-ui/App.tsx`
- `deck-go/frontend-new/src/deck-ui/Shell.tsx`

Only chat receives the `deck-ui-content--workbench` content class. Other modules
share a more generic content container, which can make prototype-to-production
translation drift if prototypes assume a full workbench canvas.

Visual defaults also amplify perceived drift:

- `deck-go/frontend-new/src/i18n/config.ts` defaults locale to `zh`
- `deck-go/frontend-new/src/theme.ts` defaults theme to `system`

For audit screenshots these were normalized to `en` and `dark`, but normal user
startup can still differ from the prototype target unless the module/test fixes
the intended visual state.

### Mock Visual Tests Are Screenshot Capture, Not Parity Tests

Existing visual specs are valuable because they open module pages with mock
Gateway data and capture screenshots. They do not currently enforce parity:

- `deck-go/test/e2e/agents-visual.spec.ts`
- `deck-go/test/e2e/sessions-visual.spec.ts`
- other `deck-go/test/e2e/*-visual.spec.ts` files

The specs use `page.screenshot(...)` but no `toHaveScreenshot`, pixel threshold,
image diff, or prototype comparison assertion was found. Therefore a passing
mock visual test means "the page opened and a screenshot was saved"; it does not
mean "the page matches the prototype."

### Current Mock Visual Run Is Not Fully Green

The current mock visual suite is also not a stable green gate:

| Spec                                   | Current result | Observed reason                                                                                                                                                                                                    |
| -------------------------------------- | -------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test/e2e/api-explorer-visual.spec.ts` |         Failed | The spec expects the methods metric to contain `3`, but `test/fixtures/mock-gateway.mjs` now describes 4 methods because `gateway.batch` is included.                                                              |
| `test/e2e/approvals-visual.spec.ts`    |         Failed | The page opened and gateway methods were called, but the expected `Approvals ready` text was not found before timeout. This indicates e2e fixture/UI state drift relative to the component-level mock expectation. |
| `test/e2e/logs-visual.spec.ts`         |         Failed | The page opened, but `Tail ready` was not found before timeout. Component unit mocks still assert this text, so the e2e mock gateway/state path has drifted.                                                       |

This matters because the earlier workflow treated mock visual evidence as a
quality signal. In the current codebase, mock visual coverage is only partial:
some specs are failing, and the passing specs still do not compare screenshots
to the handoff prototypes.

### Mock Prototype Comparison

After the mock run, a separate contact sheet compared each handoff prototype
against the primary mock screenshot where available. This removes the real
Gateway empty-data problem from the comparison. The result is still not strict
prototype parity.

| Module       |              Mock status |        Mock vs prototype gap | Notes                                                                                                                                               |
| ------------ | -----------------------: | ---------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity     |     Screenshot available |                         High | Mock data fills the page, but current UI is a grouped monitor/detail workbench while the prototype is a flat event timeline.                        |
| Agents       |     Screenshot available |                         High | Prototype is a compact inventory list; current mock page adds KPI cards, tabs, and persistent detail/edit surface.                                  |
| Alerts       |     Screenshot available |                         High | Prototype is table-first with direct rule scanning; current mock page is list/detail with a larger selected-rule panel.                             |
| API Explorer | Failed before screenshot | Unknown from mock screenshot | The test is stale against the mock gateway method count. Prototype comparison cannot be claimed from this run.                                      |
| Approvals    | Failed before screenshot | Unknown from mock screenshot | The e2e mock path does not reach the expected ready state. Prototype comparison cannot be claimed from this run.                                    |
| Budget       |     Screenshot available |                  Medium/High | Both show rule inventory and threshold detail, but composition, hierarchy, and density differ.                                                      |
| Channels     |     Screenshot available |                       Medium | Both are channel inventory pages; current mock keeps the app shell and different KPI/detail treatment.                                              |
| Chat         |     Screenshot available |                   Low/Medium | This is among the closest mock matches. It keeps the chat workbench shape, but shell, spacing, transcript density, and canvas details still differ. |
| Config       |     Screenshot available |                         High | Prototype is a curated section editor with draft preview. Current mock exposes raw JSON and schema lookup side-by-side.                             |
| Cron         |     Screenshot available |                  Medium/High | Same scheduled-job concept, but current selected-detail layout and controls diverge from prototype.                                                 |
| Docs         |     Screenshot available |                         High | Prototype is a document reader with tree navigation; current mock is a doc-hub/card/detail composition.                                             |
| Gateway      |     Screenshot available |                       Medium | Broad control-plane concepts align, but current panel uses a different monitor layout and method/detail treatment.                                  |
| Identity     |     Screenshot available |                       Medium | Both cover canonicals and peers, but current page uses a different card/detail hierarchy.                                                           |
| Logs         | Failed before screenshot | Unknown from mock screenshot | The e2e mock path does not reach `Tail ready`, so mock parity is unproven.                                                                          |
| Memory       |     Screenshot available |                         High | Prototype opens with a selected Markdown-like memory document; current mock primary state shows no selected memory.                                 |
| Models       |     Screenshot available |                         High | Prototype is a model inventory table; current mock is provider/catalog operations with selected detail.                                             |
| Nodes        |     Screenshot available |                  Medium/High | Both cover node pairing/commands, but current page is a different list/detail operations workbench.                                                 |
| Plugins      |     Screenshot available |                         High | Prototype is a dense plugin table; current mock is inventory list plus selected plugin detail.                                                      |
| Routing      |     Screenshot available |                  Medium/High | Concepts overlap, but layout, simulator placement, and rule hierarchy differ.                                                                       |
| Sessions     |     Screenshot available |                   Low/Medium | One of the closer mock pages. It has inventory/detail/actions, but shell, card layout, and field grouping differ.                                   |
| Settings     |     Screenshot available |                         High | Prototype is app-preferences oriented. Current mock emphasizes runtime/config status and local settings summaries.                                  |
| Skills       |     Screenshot available |                         High | Prototype is table-first catalog management; current mock is list/detail skill operations.                                                          |
| Subagents    |     Screenshot available |                         High | Prototype is a dense run table; current mock is selected-run list/detail with lineage tabs.                                                         |
| Threads      |     Screenshot available |                         High | Prototype is a channel-agent binding table; current mock is relationship list/detail.                                                               |
| Usage        |     Screenshot available |                  Medium/High | Both are usage cockpits, but prototype emphasizes charts and quota cards while current mock uses bars, drilldowns, and provider pressure cards.     |
| Webhooks     |     Screenshot available |                  Medium/High | Both are receiver list/detail pages, but current mock changes density, summary hierarchy, and delivery detail placement.                            |

The contact-sheet review is more useful than the pixel-diff file. Because all
screens are dark and share broad shell/background regions, raw pixel mismatch
can understate semantic layout drift. The visual issue is mainly structural:
table-first prototypes became list/detail workbenches, selected-document
prototypes became empty-selection states, and single-module canvases became
generic shell pages.

### Why Mock Verification Did Not Catch This

The mock visual workflow did not fail on prototype drift because it was not
designed as a parity gate:

1. It asserts selected text, test IDs, and interaction states, not design
   fidelity.
2. It records screenshots for human/manual review but does not compare them to
   `frontend-handoff/modules/<module>/prototype.html`.
3. It does not force a prototype-derived visual seed for every module. Some
   modules open with a generic primary state that is valid product data but not
   the designed prototype state.
4. It allows production shell differences without an explicit decision about
   whether the shell is part of the target visual.
5. It accepted older implementations that were contract-correct even when they
   were not visual translations of the current prototype.

### Some Module Notes Explicitly Accept Non-Rewrite Passes

Several handoff implementation notes show that at least some module passes did
not attempt strict prototype translation:

- `deck-go/frontend-handoff/modules/activity/implementation-notes.md` records a
  contract-focused pass rather than a full UI rewrite.
- `deck-go/frontend-handoff/modules/channels/implementation-notes.md` records
  that production still used an older two-column workbench shape.
- `deck-go/frontend-handoff/modules/skills/implementation-notes.md` records that
  no production UI rewrite was made in that pass.

This explains why real current pages can be structurally different from their
prototype files even when the module has an implementation status.

### Sessions Real-Data Crash

The `sessions` panel is currently blocked by a real-data nullability bug:

- real endpoint: `/api/usage/sessions?includeContextWeight=true&limit=1`
- observed payload contains `contextWeight.skills.entries: null`
- observed payload contains `contextWeight.tools.entries: null`
- component code assumes `.entries.length`

The failure appears in:

- `deck-go/frontend-new/src/components/panels/sessions/SessionUsageDetails.tsx`

Correction should normalize nullable arrays at the API/facade boundary or guard
in the component, with a regression test using the real observed shape.

## Correction Principles

1. Treat the handoff prototype as the visual target unless a module explicitly
   records a product decision to revise it.
2. Separate three evidence layers:
   - mock visual parity;
   - real Gateway functional contract behavior;
   - real Gateway visual readiness with seeded data.
3. Do not mark a module visually aligned from screenshot capture alone. Require
   human visual sign-off, baseline image diff, or a structured visual verdict.
4. When real Gateway cannot provide enough data, record the seed gap separately
   instead of silently accepting empty pages.
5. Fix deterministic code defects immediately; only defer environment-dependent
   real E2E failures.

## Follow-Up Work Items

- Add or run a mock visual audit that compares each module screenshot with its
  handoff prototype, not merely captures screenshots.
- Fix the sessions nullable `entries` crash.
- For each high-gap module, decide whether to:
  - re-implement from the current prototype;
  - revise the prototype first; or
  - explicitly adopt a production shell pattern that differs from the prototype.
- Add a visual parity gate for future module OpenSpec changes.
- Seed or fixture real Gateway data per module before claiming real visual
  readiness.
