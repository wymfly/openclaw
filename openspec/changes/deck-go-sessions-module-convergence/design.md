## Context

The current Sessions module is already contract-rich. Production code uses the
Deck BFF/API facade for inventory, previews, selected detail, chat history,
usage/context, compaction checkpoints, subagent lineage, transcript cache,
export preview, and guarded mutations. Real-stack and mock evidence already
exist for those routes.

The convergence problem has two layers:

1. **Module truth**: Sessions should be designed from OpenClaw session
   capabilities and Deck's adapted contract chain, not from a simple endpoint
   inventory. Existing notes already classify many workflows, but this change
   must refresh that matrix before implementation and directly fix
   deterministic drift when found.
2. **Product expression**: The active handoff prototype and production panel
   expose too many domains at once: the left inventory, center detail, right
   mutation controls, usage/context, compaction, lineage, transcript, and action
   result can all be visible in the same viewport.

Fresh module-convergence explore found several product-boundary facts that
must shape the proposal before implementation:

- OpenClaw Gateway exposes Sessions read, write, and admin methods. Deck BFF
  adapts most of them under chat/session routes, but not every Gateway
  parameter is Deck-facing product UI yet.
- `sessions.create`, `sessions.send`, `sessions.abort`, and `sessions.steer`
  are contractually session methods, but their product home is Chat/runtime
  execution. Sessions should understand and link to those workflows without
  duplicating them.
- The Deck UI metadata marks reset, clear, compact, delete, and compaction
  restore as confirmation-required. Current production Sessions code already
  confirms compact/delete, but reset/clear currently execute on first click;
  that is deterministic safety drift unless later code truth proves otherwise.
- Gateway exposes advanced knobs that Deck currently projects only partly:
  extra list filters (`includeGlobal`, `includeUnknown`, `label`,
  `spawnedBy`), preview `limit/maxChars`, compact `maxLines`, delete
  transcript/hook flags, and advanced patch fields for execution/subagent
  routing. This change should classify them instead of pretending the UI is an
  exhaustive Gateway editor.

The user selected the "list + selected session workbench + default-open
Inspector" direction during brainstorming:

- The Inspector stays visible by default on desktop.
- The Inspector uses tabs, not accordion.
- `Overview`, `Usage`, `Compaction`, `Lineage`, and `Actions` are the tab set.
- Existing selected-session data loading is preserved; tabs only control
  visibility and hierarchy, not whether the contract chain is exercised.
- The previous handoff prototype must remain as a versioned backup before
  `prototype.html` is replaced.

## Goals / Non-Goals

**Goals:**

- Reconfirm Sessions module truth from Gateway generated methods, Deck BFF
  routes, Deck-facing DTOs, frontend wrappers, handoff docs, production code,
  mock fixtures, and real E2E evidence before changing UI.
- Keep or update a workflow-to-contract matrix for inventory, previews, detail,
  history/cache, usage/context, usage logs, compaction list/branch/restore,
  lineage, parent/child navigation, reset, clear, patch, compact, delete,
  create/send/abort/steer adjacency, Gateway-only parameter knobs, BFF-only
  browser access, export, and projected/unsupported behavior.
- Decide and record which workflows are Sessions-owned, adjacent-owned,
  product-local, skipped-safe, or unsupported so implementation does not
  mistake Gateway method inventory for product scope.
- Directly fix deterministic Sessions-scoped drift found during explore or
  verification when the correct behavior is not ambiguous.
- Reduce the first-viewport density of Sessions without removing current
  Gateway-backed workflows.
- Make the page read as an enterprise control-plane workbench: browse sessions
  on the left, review one selected session in the center, inspect/manage
  secondary evidence on the right.
- Update the active handoff prototype and documentation first, while preserving
  the old prototype as a backup.
- Translate the new active prototype into `frontend-new` with design-system
  tokens, Inter/JetBrains Mono typography, canonical atoms, and local molecules
  only when justified.
- Preserve existing request timing, transcript cache, BFF-only browser access,
  mutation wrappers, and guarded destructive actions.
- Enforce confirmation for reset, clear, compact, delete, and restore according
  to Deck UI metadata, with tests proving first click arms the action and does
  not call the mutation wrapper.
- Strengthen verification so mock functional evidence, prototype parity
  evidence, and real Gateway product-surface evidence all match the new
  hierarchy.

**Non-Goals:**

- Do not invent new Gateway APIs or product features not supported by current
  Gateway/Deck contract truth.
- Do not introduce server-side session pagination, cursor contracts, or live
  panel refresh.
- Do not change the Deck-facing session DTO source or generated Gateway
  protocol unless deterministic drift is discovered during implementation.
- Do not add a new tab/router dependency. Reuse `SegmentedControl` or a local
  tab molecule built from existing design-system primitives.
- Do not add a Chat composer, live send, abort, or steer controls to the
  Sessions page in this pass.
- Do not expose every Gateway `sessions.patch`, `sessions.list`,
  `sessions.preview`, `sessions.compact`, or `sessions.delete` option as UI
  controls merely because the Gateway supports it.
- Do not execute destructive real Gateway mutations against non-run-scoped
  operator sessions.
- Do not turn usage, compaction, or lineage into tab-triggered lazy fetches in
  this pass.

## Decisions

### D1: Gateway/Deck contract truth comes before visual redesign

Implementation starts by refreshing the module capability matrix from current
code truth:

- Gateway generated methods and schemas: `sessions.list/get/preview/usage`,
  `sessions.compaction.*`, `sessions.patch/reset/clear/delete`, and adjacent
  chat session actions.
- Deck BFF routes and Go runtime adapter/projection behavior.
- Deck-facing DTOs and list-query/UI/mutation metadata.
- Frontend API wrappers and current production usage.
- Mock/real E2E evidence and handoff residual-risk notes.

The UI may improve product grouping, but it must not silently promote
projected behavior into guaranteed behavior. Deterministic drift is fixed at
the source-owned layer; ambiguous product expansions are recorded as residual
questions.

Alternative considered: treat this as UI-only because prior Sessions proposals
already verified contracts. Rejected because the user's module-convergence
standard requires contract/product/code verification in the same pass.

### D2: Preserve the previous prototype before replacing the active target

Before changing `frontend-handoff/modules/sessions/prototype.html`, copy the
current file to a versioned backup such as `prototype-v1-dense.html`. The new
`prototype.html` becomes the active visual target. Handoff README and parity
notes must name both files so future agents understand why the visual target
changed.

Alternative considered: update production only and leave the old prototype.
Rejected because prototype parity would continue comparing the new UI against a
known over-dense target.

### D3: Use list + workbench + default-open Inspector

The page keeps three logical regions, but their responsibilities change:

- **Inventory**: search, filters, pagination, session rows.
- **Selected workbench**: selected-session hero, concise runtime summary,
  transcript search/export, transcript list.
- **Inspector**: secondary and mutating workflows, organized by tabs.

Alternative considered: table-first audit layout. Rejected because Sessions is
not only an audit list; transcript reading and selected-session operations are
first-class workflows. Alternative considered: mode-based Browse/Review/
Maintenance layout. Rejected as too large a behavioral change for this pass.

### D4: Inspector tabs are hierarchy, not data-fetch ownership

The selected session still loads detail/history, usage/context, compaction,
and lineage according to the current selected-session flow. Tabs only choose
which secondary section is visible. This keeps real E2E and contract coverage
honest while lowering visual density.

Alternative considered: lazy-load tab data only when each tab opens. Rejected
because it adds new state synchronization risks and could weaken the existing
contract-chain evidence.

### D5: Keep Actions isolated and guarded

Patch, compact, reset, clear, delete, and latest action result move into the
Inspector `Actions` tab. Compact and delete retain two-step confirmation.
Delete remains visually dangerous and last in the destructive group. Action
errors stay near the action surface.

Alternative considered: keep patch controls always visible in the right rail.
Rejected because the user explicitly called out density; patch controls are
important but not primary reading state.

### D6: Use existing design-system posture, no new dependency or token

The UI should use existing `--ds-*` tokens, Inter/JetBrains Mono, low radii,
bounded surfaces, focus-visible states, and canonical atoms. `SegmentedControl`
is the preferred tab control unless implementation evidence shows it is
insufficient for the Inspector layout.

Alternative considered: introduce a tab component library or new canonical
pattern. Rejected because a local Sessions tab composition is enough for this
single module and avoids premature design-system expansion.

### D7: Treat Sessions as browse, inspect, and guarded maintenance

Sessions owns three product workflows:

```txt
Gateway Sessions API
        │
        ▼
Deck BFF / DTO adaptation
        │
        ▼
Sessions product workbench
  ├─ Browse / locate: inventory, search, filters, preview, selection
  ├─ Inspect / understand: detail, transcript, usage/context, compaction, lineage
  └─ Maintain / safeguard: patch safe fields, reset, clear, compact, delete,
                           branch/restore checkpoint actions
```

This taxonomy is the implementation frame. The UI may show many facts, but each
fact must answer one of those three workflow jobs. Anything outside those jobs
is adjacent-owned, projected, or unsupported.

### D8: Keep adjacent modules explicit

Chat session creation, message sending, abort, and steer stay Chat/runtime
execution workflows. Sessions may provide selected-session evidence and, where
existing shell/navigation patterns allow, contextual navigation back to Chat,
but it does not implement a second composer.

Subagent lineage belongs in Sessions only as selected-session relationship
evidence and local parent/child navigation. Full subagent orchestration remains
owned by the Subagents module. Session usage/context belongs in Sessions only
for the selected session; aggregate reporting remains owned by Usage.

### D9: Safety model follows UI metadata, not button convenience

Reset, clear, compact, delete, and compaction restore are all confirmation-
required. The first click arms the action and changes the button/affordance;
only the confirming click invokes the mutation wrapper. Patch remains a
mutating action and should expose only a safe, understandable subset: label,
model, thinking level, fast mode, and other low-risk session display/runtime
controls already supported by code truth.

Advanced patch fields such as execution host/security/ask/node, elevated/trace
levels, spawn metadata, subagent control scope, send policy, and group
activation are Gateway-supported but not automatically product-visible. They
must be classified in handoff notes before any UI expansion.

### D10: Gateway-only knobs are classification work unless product value is clear

The refreshed matrix must name Gateway-supported but BFF/product-unsurfaced
parameters:

- `sessions.list`: `includeGlobal`, `includeUnknown`, `label`, `spawnedBy`,
  derived title and last-message options.
- `sessions.preview`: `limit`, `maxChars`.
- `sessions.create`: caller-supplied `key` and `task`.
- `sessions.compact`: `maxLines`.
- `sessions.delete`: `deleteTranscript`, `emitLifecycleHooks`.
- `sessions.patch`: advanced runtime, execution, spawn, and subagent fields.

This change should not expose these knobs by default. If implementation finds a
deterministic BFF forwarding bug for an already-owned workflow, fix it. If the
question is product value, record it as a future decision.

### D11: Local decomposition is part of convergence

The existing `SessionsPanel` is large because it mixes data orchestration,
selection/cache state, visual layout, transcript tools, and mutation controls.
Implementation should separate local controller logic from presentational
inventory, workbench, Inspector, and action sections when doing so directly
supports the new product structure. This does not create a new cross-module
design-system pattern unless two or more modules need the same abstraction.

## Risks / Trade-offs

- **[Risk] The proposal still drifts into UI-only work.** -> Tasks must start
  with a fact baseline and capability matrix update before prototype or
  production UI edits.
- **[Risk] Contract findings expand scope.** -> Fix deterministic scoped drift;
  record ambiguous Gateway/product expansions as handoff questions instead of
  implementing speculative behavior.
- **[Risk] Hidden tab content may look like missing functionality.** -> Keep
  Inspector default-open, use clear tab labels and badge summaries, and verify
  important tabs in mock and real E2E.
- **[Risk] Existing tests assert text that moves into inactive tabs.** -> Update
  focused tests to switch tabs before asserting secondary sections.
- **[Risk] Handoff and production can drift again.** -> Backup old prototype,
  update the 6-piece handoff, then require prototype-current comparison
  evidence against the new active prototype.
- **[Risk] Real Gateway exposes sparse usage/compaction/lineage data.** -> Keep
  mock parity for dense states and real E2E for route shape/product-surface
  behavior; classify sparse real data as empty-valid/degraded when appropriate.
- **[Risk] The main component is already large.** -> Implementation should
  extract local presentational molecules or helper sections when doing so
  directly supports the new layout, but avoid unrelated refactors.
- **[Risk] Gateway method inventory is mistaken for product scope.** ->
  Require every workflow in the matrix to identify ownership: Sessions-owned,
  adjacent-owned, product-local, unsupported/projected, or skipped-safe.
- **[Risk] A destructive action is made safer visually but still executes on
  first click.** -> Focused tests must assert reset, clear, compact, delete,
  and restore do not invoke mutation wrappers until confirmed.

## Migration Plan

1. Establish a tracked fact baseline from this proposal, the current handoff,
   current production code, contracts, tests, real E2E, and user-approved
   brainstorming decisions.
2. Refresh the Sessions capability matrix and classify supported, degraded,
   adjacent-owned, projected, skipped-safe, and unsupported workflows.
3. Fix deterministic Sessions-scoped contract/code/test/handoff drift found
   during the matrix pass.
4. Backup the old Sessions prototype and update the handoff package to define
   the new list/workbench/Inspector-tab active visual target.
5. Implement the new production hierarchy while preserving API wrappers,
   selected-session loading, transcript cache, and guarded mutations.
6. Update i18n and focused component tests.
7. Run mock visual evidence and prototype parity evidence against the new
   active prototype.
8. Run or refresh real Gateway product-surface evidence for navigation,
   theme/locale variants, tab interactions, run-scoped fixture behavior,
   guarded action confirmation, BFF-only browser transport, and unexpected
   error checks.
9. Update handoff notes/evidence manifest and OpenSpec tasks only after fresh
   evidence exists.

Rollback is straightforward: restore `prototype.html` from the backup, revert
the Sessions production layout changes, and keep contract/backend files
unchanged unless deterministic drift fixes were separately justified.

## Open Questions

(none)
