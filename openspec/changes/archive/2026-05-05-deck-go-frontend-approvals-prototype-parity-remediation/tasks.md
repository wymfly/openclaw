## 1. Scope And Truth Sources

- [x] 1.1 Read the remediation head proposal, design, specs, tasks, and matrix.
- [x] 1.2 Confirm the active approvals prototype path and classify older
      prototype files as historical or superseded.
- [x] 1.3 Read approvals handoff files needed for queue, detail, decision bar,
      policy editor, stream states, interactions, and implementation notes.
- [x] 1.4 Inspect the current production approvals implementation, tests, API
      wrappers, stream hook, contract/backend paths, and current diff before
      editing.

## 2. Prototype And Contract Reconciliation

- [x] 2.1 Compare prototype assumptions with approval DTOs, BFF routes,
      stream payloads, mutation evidence, and prior real-contract notes.
- [x] 2.2 Identify deterministic visual or functional gaps between the active
      prototype and current `frontend-new` mock-current page.
- [x] 2.3 Classify each gap as fix-now, accepted exception, Gateway constraint,
      product decision, skipped-safe mutation, or later redesign deferral.
- [x] 2.4 Update approvals handoff notes with source-linked accepted exceptions
      or contract-truth decisions.

## 3. Implementation

- [x] 3.1 Fix approvals UI, fixture, stream hook, API wrapper, contract,
      backend, or handoff-doc drift when the correct behavior is deterministic
      and scoped.
- [x] 3.2 Preserve existing supported approvals workflows, BFF-only frontend
      access, mutation evidence semantics, and non-approvals panel behavior.
- [x] 3.3 Avoid automated real approval or policy mutations unless disposable
      fixtures and cleanup are proven.

## 4. Evidence

- [x] 4.1 Run focused approvals frontend tests after implementation.
- [x] 4.2 Run focused backend/contract checks if backend or contract files are
      touched.
- [x] 4.3 Run the approvals mock visual E2E.
- [x] 4.4 Generate or refresh approvals prototype-current comparison artifacts.
- [x] 4.5 Write the approvals structured visual verdict and accepted-exception
      ledger.
- [x] 4.6 Attempt bounded real Gateway evidence for safe reads and UI rendering,
      or record a circuit-breaker/skipped-safe handoff for unsafe mutations.
- [x] 4.7 In real Gateway E2E, verify shell navigation into Approvals, light and
      dark themes, English and Chinese locales, and safe child-surface
      interactions.
      Implemented in `approvals-real-gateway.spec.ts`; full run is
      circuit-breaker blocked by dirty-tree Gateway rebuild/runtime-postbuild
      startup before RPC readiness.
- [x] 4.8 Create run-scoped real approval/policy test data only if disposable
      fixture creation and cleanup are proven; otherwise record skipped-safe
      mutation evidence.
      Exec approval fixture now uses supported two-phase Gateway params and
      guarded BFF cleanup; full visibility/cleanup proof is pending the shared
      real-stack startup blocker. Policy save remains skipped-safe.

## 5. Closeout

- [x] 5.1 Update `frontend-prototype-remediation-matrix.md` with the approvals
      child proposal, verdict, evidence paths, and real status.
- [x] 5.2 Run `openspec validate deck-go-frontend-approvals-prototype-parity-remediation --strict`.
- [x] 5.3 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [x] 5.4 Archive the approvals child proposal after all tasks are complete.
- [x] 5.5 Update the head proposal task 4.2 status; defer commit to the
      grouped goal commit because shared real-E2E helper and contract-chain
      files contain uncommitted dependencies outside this child proposal.
