# subagents implementation notes

## Production alignment checklist

- Preserve existing API wrappers and panel registry wiring.
- Keep polling and selection stickiness.
- Keep kill confirmation.
- Keep global defaults editing through config get/apply.
- Remove obsolete `deck-ui-subagents` global styling once local CSS owns the
  module.
- Update unit tests by behavior, not by old shell class counts.

## Design-system feedback

- `Badge`, `Button`, `Card`, `Input`, `Select`, `SegmentedControl`,
  `Textarea`, and `Toggle` are sufficient for this pass.
- Metric tiles, queue rows, selected-run hero, lineage nodes, and section header
  rhythm repeat agents/routing patterns and are promotion candidates for a
  later design-system proposal.
- No token or canonical atom change is required by this module.

## Verification target

- `openspec validate frontend-subagents-hifi-contract-redesign --strict`
- focused subagents unit tests
- focused backend route test for `/deck/subagents` query forwarding
- mock visual Playwright E2E for ready workbench and interaction state
- `make frontend-build`
