## 1. Scope And Truth Sources

- [x] 1.1 Read the remediation head proposal, design, specs, tasks, and matrix.
- [x] 1.2 Confirm the active Sessions prototype path and read Sessions handoff
      README, components, states, interactions, API usage, and implementation
      notes.
- [x] 1.3 Inspect current Sessions production code, helper components, CSS,
      API wrappers, contracts, backend projection/adapter paths, mock fixtures,
      and mock/real E2E specs.
- [x] 1.4 Inspect current worktree diff before editing and avoid reverting
      unrelated changes.

## 2. Prototype And Contract Reconciliation

- [x] 2.1 Compare prototype assumptions with Sessions DTOs, BFF routes,
      Gateway-generated protocol truth, and real-contract notes.
- [x] 2.2 Identify deterministic visual or functional gaps between the active
      prototype and current `frontend-new` mock-current page.
- [x] 2.3 Classify each gap as fix-now, accepted exception, Gateway constraint,
      product decision, empty-valid/degraded real data, or later redesign
      deferral.
- [x] 2.4 Update Sessions handoff notes with source-linked accepted exceptions
      or contract-truth decisions.

## 3. Implementation

- [x] 3.1 Add focused coverage for nullable/partial `contextWeight` nested
      fields from real Gateway data.
- [x] 3.2 Fix the nullable context-weight crash and any related deterministic
      DTO/UI shape drift.
- [x] 3.3 Fix Sessions UI, CSS, fixture, API facade, contract, backend, or
      handoff-doc drift when the correct behavior is deterministic and scoped.
- [x] 3.4 Preserve transcript cache, guarded compact/delete actions,
      patch/reset/clear semantics, BFF-only frontend access, and non-Sessions
      panel behavior.

## 4. Evidence

- [x] 4.1 Run focused Sessions frontend tests after implementation.
- [x] 4.2 Run focused backend/contract checks if backend or contract files are
      touched.
- [x] 4.3 Run the Sessions mock visual E2E.
- [x] 4.4 Generate or refresh Sessions prototype-current comparison artifacts.
- [x] 4.5 Write the Sessions structured visual verdict and accepted-exception
      ledger.
- [x] 4.6 Run strengthened real Gateway evidence: shell navigation into
      Sessions, dark/light themes, English/Chinese locales, child
      interactions, BFF-only browser transport, unexpected error checks, and
      run-scoped session fixture creation/cleanup.
- [x] 4.7 If real Gateway fixture creation or cleanup circuit-breaks, record the
      command, environment, attempt count, observed payload/status, and next
      action.

## 5. Closeout

- [x] 5.1 Update `frontend-prototype-remediation-matrix.md` with the Sessions
      child proposal, verdict, evidence paths, and real status.
- [x] 5.2 Run
      `openspec validate deck-go-frontend-sessions-prototype-parity-remediation --strict`.
- [x] 5.3 Run
      `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [x] 5.4 Archive the Sessions child proposal after all tasks are complete.
- [x] 5.5 Update the head proposal task 4.4 status; defer commit to the grouped
      goal commit if shared uncommitted dependencies remain.
