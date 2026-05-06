## 1. Scope And Truth Sources

- [x] 1.1 Read the remediation head proposal, design, specs, tasks, and matrix.
- [x] 1.2 Confirm the active logs prototype path and classify older prototype
      files as historical or superseded.
- [x] 1.3 Read logs handoff files needed for stream pane, filter bar, row
      rendering, details pane, dialogs, states, interactions, and
      implementation notes.
- [x] 1.4 Inspect the current production logs implementation, tests, API
      wrappers, stream hook/projection path, contract/backend paths, and current
      diff before editing.

## 2. Prototype And Contract Reconciliation

- [x] 2.1 Compare prototype assumptions with logs DTOs, BFF routes, stream
      payloads, real-contract notes, and generated Gateway protocol truth.
- [x] 2.2 Identify deterministic visual or functional gaps between the active
      prototype and current `frontend-new` mock-current page.
- [x] 2.3 Classify each gap as fix-now, accepted exception, Gateway constraint,
      product decision, empty-valid/degraded real data, or later redesign
      deferral.
- [x] 2.4 Update logs handoff notes with source-linked accepted exceptions or
      contract-truth decisions.

## 3. Implementation

- [x] 3.1 Fix logs UI, parser, fixture, stream hook/projection, API wrapper,
      contract, backend, or handoff-doc drift when the correct behavior is
      deterministic and scoped.
- [x] 3.2 Preserve existing supported logs workflows, BFF-only frontend access,
      dynamic raw-payload evidence, and non-logs panel behavior.
- [x] 3.3 Avoid fabricating real log data; use mock data for dense visual states
      and real data only for actual tail/stream evidence.

## 4. Evidence

- [x] 4.1 Run focused logs frontend tests after implementation.
- [x] 4.2 Run focused backend/contract checks if backend or contract files are
      touched.
- [x] 4.3 Run the logs mock visual E2E.
- [x] 4.4 Generate or refresh logs prototype-current comparison artifacts.
- [x] 4.5 Write the logs structured visual verdict and accepted-exception
      ledger.
- [x] 4.6 Attempt bounded real Gateway evidence for safe reads, stream
      reachability, UI rendering, and BFF-only browser transport, or record a
      circuit-breaker/empty-valid handoff.
- [x] 4.7 In real Gateway E2E, verify shell navigation into Logs, light and dark
      themes, English and Chinese locales, and safe child-surface interactions.
- [x] 4.8 In real Gateway E2E, trigger safe run-scoped Deck/Gateway activity
      before judging data availability, without fabricating log rows or mutating
      non-isolated user state.

## 5. Closeout

- [x] 5.1 Update `frontend-prototype-remediation-matrix.md` with the logs child
      proposal, verdict, evidence paths, and real status.
- [x] 5.2 Run `openspec validate deck-go-frontend-logs-prototype-parity-remediation --strict`.
- [x] 5.3 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [x] 5.4 Archive the logs child proposal after all tasks are complete.
- [x] 5.5 Update the head proposal task 4.3 status; defer commit to the grouped
      goal commit if shared uncommitted dependencies remain.
