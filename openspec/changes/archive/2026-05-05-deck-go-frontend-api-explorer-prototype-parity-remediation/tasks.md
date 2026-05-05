## 1. Scope And Truth Sources

- [x] 1.1 Read the remediation head proposal, design, specs, tasks, and matrix.
- [x] 1.2 Confirm the active API Explorer prototype path and classify older
      prototype files as historical or superseded.
- [x] 1.3 Read API Explorer handoff files needed for workspace, method tree,
      request builder, response pane, history rail, states, and interactions.
- [x] 1.4 Inspect the current production API Explorer implementation, tests,
      API wrappers, and relevant contract/backend paths before editing.

## 2. Prototype And Contract Reconciliation

- [x] 2.1 Compare prototype assumptions with Gateway describe/invoke contract
      truth and prior real-contract verification notes.
- [x] 2.2 Identify deterministic visual or functional gaps between the active
      prototype and current `frontend-new` mock-current page.
- [x] 2.3 Classify each gap as fix-now, accepted exception, Gateway constraint,
      product decision, or later redesign deferral.
- [x] 2.4 Update API Explorer handoff notes with source-linked accepted
      exceptions or contract-truth decisions.

## 3. Implementation

- [x] 3.1 Fix API Explorer UI, fixture, API wrapper, contract, or backend drift
      when the correct behavior is deterministic and scoped.
- [x] 3.2 Preserve existing Gateway describe/invoke contract chain and
      non-API-Explorer panel behavior.
- [x] 3.3 Avoid unsafe real Gateway invocations unless the method is known
      read-only and environment-safe.

## 4. Evidence

- [x] 4.1 Run focused API Explorer frontend tests after implementation.
- [x] 4.2 Run focused backend/contract checks if backend or contract files are
      touched.
- [x] 4.3 Run the API Explorer mock visual E2E.
- [x] 4.4 Generate or refresh API Explorer prototype-current comparison
      artifacts.
- [x] 4.5 Write the API Explorer structured visual verdict and
      accepted-exception ledger.
- [x] 4.6 Attempt bounded real Gateway evidence for describe, method selection,
      and a safe invocation path, or record a circuit-breaker handoff.

## 5. Closeout

- [x] 5.1 Update `frontend-prototype-remediation-matrix.md` with the API
      Explorer child proposal, verdict, evidence paths, and real status.
- [x] 5.2 Run `openspec validate deck-go-frontend-api-explorer-prototype-parity-remediation --strict`.
- [x] 5.3 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [x] 5.4 Archive the API Explorer child proposal after all tasks are complete.
- [x] 5.5 Update the head proposal task 4.1 status and commit the API Explorer
      remediation work.
