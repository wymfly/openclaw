## Context

The design-system pattern layer already contains six canonical patterns:
`PageShell`, `NavRail`, `TopBar`, `EmptyState`, `KbdHint`, and
`SectionHeader`. Their README and `design-system-patterns` spec define a strict
promotion gate for any seventh-or-beyond pattern:

- at least two panels must demonstrate the same shell shape,
- a reuse-analysis proposal must explain why existing patterns cannot be
  extended,
- engineering owner sign-off is required before code lands.

The Agents reflowback candidates file intentionally parks `Avatar`, `ListRow`,
`StatusPill`, and `FileRow` until another module proves the same shape. The
current matrix item should therefore close by recording that no new pattern is
promoted without gate evidence, not by extracting abstractions prematurely.

## Goals / Non-Goals

**Goals:**

- Make the pattern contract documentation non-placeholder and understandable.
- Record the current extraction audit outcome in the design-system pattern
  README.
- Mark the matrix decision and proposal item as archived with explicit evidence.
- Verify existing pattern tests and frontend build still pass.

**Non-Goals:**

- Do not add new patterns, molecules, tokens, or atoms without a reuse-analysis
  proposal.
- Do not migrate existing panels to patterns in this change.
- Do not change visual presentation.
- Do not alter module contracts, BFF routes, Gateway schemas, or real E2E
  fixtures.

## Decisions

### Decision: No speculative new pattern extraction

The matrix item is closed as an audit/settlement change. Existing canonical
patterns stay authoritative, and parked candidate shapes remain local until the
reuse-analysis gate is satisfied.

Alternative rejected: promote candidates such as `ListRow` or `StatusPill` based
on visual similarity alone. That would freeze an API before product modules prove
their shared behavior and would risk destabilizing finished module surfaces.

### Decision: Fix stale archived pattern spec purpose

The `design-system-patterns` spec is already a durable OpenSpec contract. Its
placeholder Purpose weakens the contract for future agents, so this change fixes
that documentation drift directly.

## Risks / Trade-offs

- **Risk:** "No extraction" may look like incomplete work.  
  **Mitigation:** Matrix and README record the explicit gate-based outcome and
  point to the parked candidates.
- **Risk:** Some panel-local duplication remains.  
  **Mitigation:** Duplication is accepted until two modules prove the same
  stable behavior and a focused proposal can migrate call sites safely.

## Migration Plan

1. Update the `design-system-patterns` spec Purpose.
2. Add a dated extraction audit note to the patterns README.
3. Update the head matrix decision/proposal rows and generated matrix Markdown.
4. Update head verification evidence.
5. Run OpenSpec validation, pattern tests, frontend build, contract-chain matrix
   check, and diff check; then archive this child proposal.
