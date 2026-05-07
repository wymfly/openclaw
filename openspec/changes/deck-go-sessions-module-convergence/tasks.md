## 1. Scope, Fact Baseline, And Contract Truth

- [ ] 1.1 Read this proposal, design, spec deltas, current Sessions handoff
      package, current production code, focused tests, mock/real E2E specs,
      Deck-facing contracts, generated Gateway artifacts, Go BFF routes, and
      runtime OpenClaw adapter/projection paths.
- [ ] 1.2 Inspect current worktree status and record unrelated pre-existing
      changes so this change does not revert or overwrite them.
- [ ] 1.3 Create or update a tracked Sessions convergence fact baseline in the
      handoff notes or implementation notes, including accepted/corrected/
      rejected/deferred findings with source file references or commands.
- [ ] 1.4 Refresh the Sessions workflow-to-contract matrix for inventory,
      previews, detail, history/cache, export, usage/context, usage logs,
      compaction list/branch/restore, lineage, parent/child navigation, reset,
      clear, patch, compact, delete, BFF-only browser access, and projected
      server-side pagination/live refresh.
- [ ] 1.5 Add explicit ownership classifications to the matrix:
      Sessions-owned, adjacent-owned, product-local, unsupported/projected,
      empty-valid, environment-dependent, and skipped-safe.
- [ ] 1.6 Classify Gateway-supported but currently BFF/product-unsurfaced
      options, including extra `sessions.list` filters, preview `limit` /
      `maxChars`, create `key` / `task`, compact `maxLines`, delete transcript
      / lifecycle-hook flags, and advanced patch execution/spawn/subagent
      fields.
- [ ] 1.7 Confirm that create/send/abort/steer are Chat/runtime-adjacent
      workflows, not Sessions page controls, unless code truth or product
      evidence proves a Sessions-owned use case.
- [ ] 1.8 Fix deterministic Sessions-scoped contract, backend, frontend, mock,
      i18n, handoff, or test drift discovered during the matrix pass when the
      correct behavior is evidence-backed and low-risk; otherwise record it as
      a residual decision with rationale.

## 2. Handoff Prototype And Product Design

- [ ] 2.1 Preserve the current
      `frontend-handoff/modules/sessions/prototype.html` as a versioned backup
      before replacing the active prototype.
- [ ] 2.2 Update `prototype.html` to the approved list + selected-session
      workbench + default-open Inspector-tab structure using the existing
      design-system posture.
- [ ] 2.3 Update Sessions `README.md`, `components.md`, `states.md`,
      `interactions.md`, and `api-usage.md` so the active visual target,
      Inspector tabs, backed capabilities, unsupported/projected behavior, and
      backup prototype path are explicit.
- [ ] 2.4 Ensure the prototype keeps display strings literal, avoids new token
      requirements unless justified, and does not claim functionality outside
      the refreshed contract matrix.
- [ ] 2.5 Update handoff docs so Sessions is described as browse, inspect, and
      guarded maintenance, with Chat/Subagents/Usage boundaries called out
      explicitly.
- [ ] 2.6 Update handoff interactions/API notes so reset, clear, compact,
      delete, and compaction restore are confirmation-required, while advanced
      Gateway-only knobs are classified instead of exposed as guaranteed UI.

## 3. Production Frontend Implementation

- [ ] 3.1 Refactor `SessionsPanel` into the new information hierarchy while
      preserving existing API wrappers, selected-session loading, transcript
      cache behavior, selection preservation, and navigation `sessionKey`
      behavior.
- [ ] 3.2 Implement the default-open Inspector with `Overview`, `Usage`,
      `Compaction`, `Lineage`, and `Actions` tabs using existing
      design-system primitives and accessible keyboard/focus behavior.
- [ ] 3.3 Move secondary evidence and mutations into the proper Inspector tabs
      without introducing tab-triggered lazy fetches.
- [ ] 3.4 Keep transcript search/export in the selected-session workbench and
      ensure export remains client-side only.
- [ ] 3.5 Keep reset, clear, patch, compact, delete, branch, and restore routed
      through the existing frontend API facades; add or preserve confirmation
      gates for reset, clear, compact, delete, and restore according to UI
      metadata, and keep dangerous-action styling.
- [ ] 3.6 Update Sessions CSS and i18n for the new hierarchy in both English
      and Chinese while preserving the normalized typography/design-system
      weight constraints.
- [ ] 3.7 Extract local presentational molecules only where they directly reduce
      the Sessions component size or clarify the new layout; avoid unrelated
      cross-module pattern promotion.
- [ ] 3.8 Do not add chat compose/send/abort/steer controls to Sessions; if an
      "open in Chat" affordance is implemented, keep it navigation-only and
      backed by the existing shell/navigation contract.

## 4. Focused Tests And Mock Evidence

- [ ] 4.1 Update or add focused `SessionsPanel` tests for selection, filters,
      transcript cache/search/export, Inspector tab switching, usage,
      compaction, lineage, and guarded actions.
- [ ] 4.2 Add focused tests proving reset, clear, compact, delete, and restore
      do not call mutation wrappers on the first click and only execute after
      confirmation.
- [ ] 4.3 Update the Sessions mock visual E2E to assert the new
      list/workbench/default-open Inspector state and at least one secondary
      Inspector tab interaction.
- [ ] 4.4 Run focused frontend tests for Sessions and fix deterministic
      failures before widening.
- [ ] 4.5 Run the Sessions mock visual E2E and save fresh mock-functional
      evidence.
- [ ] 4.6 Generate or refresh prototype-current comparison artifacts against
      the new active `prototype.html`, including active prototype screenshot,
      mock-current screenshot, side-by-side comparison, structured verdict, and
      accepted exceptions.

## 5. Real Gateway Product-Surface Evidence

- [ ] 5.1 Update real Sessions E2E so it covers Deck shell navigation into
      Sessions, dark English and light Chinese variants, run-scoped fixture
      behavior, BFF-only browser transport, unexpected console/page/API errors,
      at least one Inspector tab switch, and confirmation-arm behavior for
      destructive/admin actions without executing unsafe mutations.
- [ ] 5.2 Preserve safe mutation boundaries: destructive real writes must run
      only against proven run-scoped targets or be recorded as skipped-safe /
      expected rejection evidence.
- [ ] 5.3 Run bounded real Gateway Sessions evidence when the environment is
      available; after 2-3 environment-only failures, record exact commands,
      statuses, payloads, and next action instead of blocking deterministic
      local completion.
- [ ] 5.4 Fix deterministic code defects found by real E2E directly; only
      circuit-break environment, credential, or upstream availability blockers.

## 6. Closeout And Validation

- [ ] 6.1 Update Sessions implementation notes and any tracked evidence
      manifest with the refreshed capability matrix, prototype backup path,
      prototype parity verdict, mock evidence, real evidence, and accepted
      exceptions.
- [ ] 6.2 Run `openspec validate deck-go-sessions-module-convergence --strict`.
- [ ] 6.3 Run the narrow relevant frontend build/test verification and any
      contract/backend checks required by touched files.
- [ ] 6.4 Mark tasks complete only after the corresponding fresh evidence
      exists.
- [ ] 6.5 Confirm archive readiness after all tasks and validations pass or
      documented environment-only circuit breakers remain.
