## Why

The head contract-chain matrix keeps one deferred design-system follow-up:
`deck-go-design-system-pattern-extraction`. Contract/product flows have now been
settled module-by-module, so the design-system item needs a final audit and
durable decision. This must not become a speculative abstraction pass: new
patterns are allowed only when at least two modules prove the same stable shape.

Explore found that the six canonical patterns already exist and are tested, and
the known Agents reflowback candidates remain parked because they have not been
promoted through the documented reuse-analysis gate. Explore also found a
deterministic documentation drift: the archived `design-system-patterns` spec
still has a placeholder Purpose.

## What Changes

- Re-audit `frontend-new/src/design-system/patterns`, the design-system pattern
  spec, and current handoff reflowback candidates.
- Fix the `design-system-patterns` spec Purpose so the archived pattern contract
  is not left as TBD.
- Document the 2026-05-05 extraction decision in the patterns README: no new
  pattern is promoted unless the reuse-analysis gate is satisfied; existing
  candidates remain parked.
- Update the head matrix decision index and proposal matrix so the deferred
  item is archived with an explicit no-new-extraction outcome.
- Update the head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-design-system-pattern-extraction`: Closes the design-system deferred
  matrix item by auditing pattern reuse signals, fixing stale pattern spec
  documentation, and documenting that no speculative new patterns were promoted.

### Modified Capabilities

- `design-system-patterns`: Replaces the placeholder Purpose with the actual
  canonical pattern contract purpose.

## Impact

- Affected docs/specs:
  `openspec/specs/design-system-patterns/spec.md`,
  `deck-go/frontend-new/src/design-system/patterns/README.md`,
  `deck-go/docs/contract-chain-audit.matrix.json`,
  generated matrix Markdown, and head verification evidence.
- Affected tests:
  focused design-system pattern tests and frontend build.
- No panel rendering, token, atom, icon, hook, or business module behavior is
  changed.
