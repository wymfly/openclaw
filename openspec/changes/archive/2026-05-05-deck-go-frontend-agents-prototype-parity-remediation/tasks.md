## 1. Scope And Truth Sources

- [x] 1.1 Read the remediation head proposal, design, specs, tasks, and matrix.
- [x] 1.2 Confirm the active agents prototype path and explicitly classify any
      other agents prototype files as historical or superseded.
- [x] 1.3 Read the agents handoff package files needed for ready, empty, error,
      create, and selected-detail states.
- [x] 1.4 Inspect the current production agents implementation, tests, API
      wrappers, and relevant contract/back-end paths before editing.

## 2. Prototype And Contract Reconciliation

- [x] 2.1 Compare the active agents prototype assumptions with the existing
      agents contract-chain and real-contract verification notes.
- [x] 2.2 Identify deterministic visual or functional gaps between the active
      prototype and current `frontend-new` mock-current page.
- [x] 2.3 Classify each gap as fix-now, accepted exception, Gateway constraint,
      product decision, or later redesign deferral.
- [x] 2.4 Update agents handoff notes with any source-linked accepted exceptions
      or contract-truth decisions.

## 3. Implementation

- [x] 3.1 Fix agents UI, fixture, API wrapper, contract, or backend drift found
      during reconciliation when the correct behavior is deterministic and
      scoped.
- [x] 3.2 Preserve existing supported agents workflows, shell integration, typed
      API facade usage, and non-agents module behavior.
- [x] 3.3 Avoid automated real mutations unless disposable or reversible agents
      state is available.

## 4. Evidence

- [x] 4.1 Run focused agents frontend tests after implementation.
- [x] 4.2 Run focused backend/contract checks if backend or contract files are
      touched.
- [x] 4.3 Run the agents mock visual E2E.
- [x] 4.4 Generate or refresh agents prototype-current comparison artifacts.
- [x] 4.5 Write the agents structured visual verdict and accepted-exception
      ledger.
- [x] 4.6 Attempt bounded real Gateway evidence for agents read-only or
      non-destructive workflows, or record a circuit-breaker handoff.

## 5. Closeout

- [x] 5.1 Update `frontend-prototype-remediation-matrix.md` with the agents
      child proposal, verdict, evidence paths, and real status.
- [x] 5.2 Run `openspec validate deck-go-frontend-agents-prototype-parity-remediation --strict`.
- [x] 5.3 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [x] 5.4 Archive the agents child proposal after all tasks are complete.
- [x] 5.5 Update the head proposal task 3.1-3.5 statuses and commit the agents
      remediation work.
