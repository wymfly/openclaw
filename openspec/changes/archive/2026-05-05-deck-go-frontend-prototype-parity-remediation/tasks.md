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
- [x] 3.6 Apply the strengthened real E2E standard to `agents`: shell navigation, light/dark, zh/en, interactive child sections, and run-scoped real fixture data.

## 4. Blocking And Failing Evidence Modules

- [x] 4.1 Remediate `api-explorer` through its own child proposal.
- [x] 4.2 Remediate `approvals` through its own child proposal.
- [x] 4.3 Remediate `logs` through its own child proposal.
- [x] 4.4 Remediate `sessions` through its own child proposal, including the real-data nullable `contextWeight.*.entries` crash.

## 5. High-Gap Product Modules

- [x] 5.1 Remediate `activity` through its own child proposal.
- [x] 5.2 Remediate `models` through its own child proposal.
- [x] 5.3 Remediate `skills` through its own child proposal.
- [x] 5.4 Remediate `plugins` through its own child proposal.
- [x] 5.5 Remediate `settings` through its own child proposal.
- [x] 5.6 Remediate `channels` through its own child proposal.
- [x] 5.7 Remediate `config` through its own child proposal.
- [x] 5.8 Remediate `docs` through its own child proposal.

## 6. Remaining Active Modules

- [x] 6.1 Remediate `alerts` through its own child proposal.
- [x] 6.2 Remediate `budget` through its own child proposal.
- [x] 6.3 Remediate `chat` through its own child proposal or record strict parity evidence if no code change is needed.
- [x] 6.4 Remediate `cron` through its own child proposal.
- [x] 6.5 Remediate `gateway` through its own child proposal or record strict parity evidence if no code change is needed.
- [x] 6.6 Remediate `identity` through its own child proposal.
- [x] 6.7 Remediate `memory` through its own child proposal.
- [x] 6.8 Remediate `nodes` through its own child proposal.
- [x] 6.9 Remediate `routing` through its own child proposal.
- [x] 6.10 Remediate `subagents` through its own child proposal.
- [x] 6.11 Remediate `threads` through its own child proposal.
- [x] 6.12 Remediate `usage` through its own child proposal.
- [x] 6.13 Remediate `webhooks` through its own child proposal.

## 7. Final Closure

- [x] 7.1 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.
- [x] 7.2 Run the final full mock visual parity audit and ensure every module has a `pass` or structured accepted exception verdict.
- [x] 7.3 Run bounded real Gateway evidence checks or confirm handoff entries for all environment-circuit-broken modules.
- [x] 7.4 Run the relevant deck-go verification gate after the final module batch.
- [x] 7.5 Perform a prompt-to-artifact completion audit against this head proposal and the module matrix.
- [x] 7.6 Archive this head proposal only after every module row is complete and no unowned `needs-fix` verdict remains.

## 8. Strengthened Real E2E Standard

- [x] 8.1 Update the module child proposal template/rubric so future real E2E evidence includes shell navigation, theme/locale variants, child-page interaction, and safe run-scoped data creation.
- [x] 8.2 Re-run the head validation after the strengthened real E2E standard is encoded.
- [x] 8.3 Expand the real E2E fixture standard so remaining modules must attempt representative run-scoped data creation through Gateway RPC, Deck BFF, isolated `openclaw.json`, or isolated workspace/session setup before accepting empty-state-only evidence.
- [x] 8.4 Tighten the real E2E product-flow rule so remaining modules validate shell navigation, both theme/locale axes, every meaningful safe child surface, and fixture-backed real data before relying on direct-panel or RPC-only evidence.
- [x] 8.5 Tighten the remaining-module real E2E rule to require four theme/locale combinations by default, Deck-shell navigation, safe subpage/dialog interaction, and representative run-scoped Gateway/config/workspace/session fixture data before accepting empty-state evidence.
