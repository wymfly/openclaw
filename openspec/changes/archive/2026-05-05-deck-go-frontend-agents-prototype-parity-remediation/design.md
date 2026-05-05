## Context

The remediation head treats `frontend-handoff/modules/<module>/prototype.html`
as the active visual authority unless contract truth or an explicit product
decision supersedes it. The agents handoff package includes both
`prototype.html` and an older `prototype-v2-codex.html`; the package README
declares `prototype.html` as the active visual target.

The previous agents real-contract proposal already mapped most agents workflows
through Gateway method, deck-go DTO, Go adapter, API facade, and production UI
evidence. This child proposal should not repeat that migration. Its purpose is
to close the missing strict visual parity proof and repair any deterministic
drift found while doing so.

## Decisions

### D1: Use `prototype.html` as active visual truth

`deck-go/frontend-handoff/modules/agents/README.md` explicitly names
`prototype.html` as the active visual target. `prototype-v2-codex.html` remains
historical context only unless the README is deliberately changed by a future
handoff.

### D2: Treat old agents evidence as supporting context, not completion proof

Prior agents mock visual and real Gateway evidence is useful for contract and
functional confidence, but it does not satisfy the new remediation head by
itself. This change must generate or reference new prototype-current comparison
artifacts and a structured verdict.

### D3: Fix known deterministic defects immediately

If comparison or real evidence reveals a scoped deterministic defect in agents
UI, API wrappers, mock fixtures, BFF normalization, or DTO nullability, this
proposal owns the fix. Only unsafe real mutations, missing upstream Gateway
capability, or environment/seed blockers may be handed off.

### D4: Keep unsafe real mutations out of automated evidence

Create, update, delete, and save actions require disposable or reversible agent
state. This proposal may verify read-only and non-destructive flows against the
real stack while leaving unsafe mutations as handoff-blocked if no isolated test
state is available.

## Verification Strategy

- Run focused agents frontend tests after any UI/API change.
- Run focused Go/backend or contract checks only if touched.
- Run agents mock visual E2E and regenerate the prototype-current parity report
  for agents.
- Record a structured visual verdict with `pass`, `needs-fix`, or accepted
  exceptions.
- Attempt bounded real Gateway agents evidence for read-only/non-destructive
  workflows and record circuit-breaker details if blocked.
