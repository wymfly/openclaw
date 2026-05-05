## 1. Head Proposal And Matrix

- [x] 1.1 Create the remediation head proposal, design, and spec deltas.
- [x] 1.2 Create a module remediation matrix covering every active `frontend-new` panel with current gap, active prototype, current implementation, mock status, real status, child proposal, accepted exceptions, and verdict.
- [x] 1.3 Update `deck-go/docs/project/frontend-prototype-gap-audit.md` so it links to this head change and explains that old screenshot-only evidence is superseded.
- [x] 1.4 Update deck-go docs or handoff protocol docs to state the new evidence levels: mock functional, mock prototype parity, and real Gateway evidence.

## 2. Shared Parity Gate Child Proposal

- [x] 2.1 Create a child OpenSpec proposal for shared prototype parity tooling and mock visual gate repair.
- [x] 2.2 Implement repeatable prototype-vs-current capture/contact-sheet/verdict tooling or test helpers.
- [x] 2.3 Fix deterministic failures in the current mock visual specs for `api-explorer`, `approvals`, and `logs`.
- [x] 2.4 Run the full mock visual suite and record which modules have only functional screenshot evidence versus strict parity evidence.
- [x] 2.5 Validate, archive, and commit the shared parity gate child proposal.

## 3. First Sample Module

- [x] 3.1 Create the `agents` module remediation child proposal using this head change as its governing rule set.
- [x] 3.2 Reconcile the active `agents` prototype with Gateway/deck-go contract truth and revise handoff artifacts only if necessary.
- [x] 3.3 Implement `agents` UI corrections until mock-current visually matches the active prototype or has structured accepted exceptions.
- [x] 3.4 Run `agents` unit/build/mock parity evidence and bounded real Gateway evidence.
- [x] 3.5 Validate, archive, and commit the `agents` remediation child proposal.

## 4. Blocking And Failing Evidence Modules

- [x] 4.1 Remediate `api-explorer` through its own child proposal.
- [ ] 4.2 Remediate `approvals` through its own child proposal.
- [ ] 4.3 Remediate `logs` through its own child proposal.
- [ ] 4.4 Remediate `sessions` through its own child proposal, including the real-data nullable `contextWeight.*.entries` crash.

## 5. High-Gap Product Modules

- [ ] 5.1 Remediate `activity` through its own child proposal.
- [ ] 5.2 Remediate `models` through its own child proposal.
- [ ] 5.3 Remediate `skills` through its own child proposal.
- [ ] 5.4 Remediate `plugins` through its own child proposal.
- [ ] 5.5 Remediate `settings` through its own child proposal.
- [ ] 5.6 Remediate `channels` through its own child proposal.
- [ ] 5.7 Remediate `config` through its own child proposal.
- [ ] 5.8 Remediate `docs` through its own child proposal.

## 6. Remaining Active Modules

- [ ] 6.1 Remediate `alerts` through its own child proposal.
- [ ] 6.2 Remediate `budget` through its own child proposal.
- [ ] 6.3 Remediate `chat` through its own child proposal or record strict parity evidence if no code change is needed.
- [ ] 6.4 Remediate `cron` through its own child proposal.
- [ ] 6.5 Remediate `gateway` through its own child proposal or record strict parity evidence if no code change is needed.
- [ ] 6.6 Remediate `identity` through its own child proposal.
- [ ] 6.7 Remediate `memory` through its own child proposal.
- [ ] 6.8 Remediate `nodes` through its own child proposal.
- [ ] 6.9 Remediate `routing` through its own child proposal.
- [ ] 6.10 Remediate `subagents` through its own child proposal.
- [ ] 6.11 Remediate `threads` through its own child proposal.
- [ ] 6.12 Remediate `usage` through its own child proposal.
- [ ] 6.13 Remediate `webhooks` through its own child proposal.

## 7. Final Closure

- [ ] 7.1 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [ ] 7.2 Run the final full mock visual parity audit and ensure every module has a `pass` or structured accepted exception verdict.
- [ ] 7.3 Run bounded real Gateway evidence checks or confirm handoff entries for all environment-circuit-broken modules.
- [ ] 7.4 Run the relevant deck-go verification gate after the final module batch.
- [ ] 7.5 Perform a prompt-to-artifact completion audit against this head proposal and the module matrix.
- [ ] 7.6 Archive this head proposal only after every module row is complete and no unowned `needs-fix` verdict remains.
