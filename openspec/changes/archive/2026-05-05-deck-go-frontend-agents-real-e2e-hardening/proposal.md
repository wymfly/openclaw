## Why

The first agents remediation child proposal produced mock prototype parity and
real read-only/API evidence, but the governing head change has now been
strengthened. Real E2E evidence must prove the product surface works through
Deck navigation, theme and locale variants, interactive child sections, and
safe run-scoped real data.

Manual real-stack inspection also exposed a deterministic agents bug: after the
user returns from detail to the list, live agent-status events can reselect the
default agent and pull the page back into detail view.

## What Changes

- Apply the strengthened real E2E rubric to the `agents` sample module.
- Fix deterministic agents selection behavior so live projection events preserve
  an explicit list state.
- Add focused store regression coverage for live events preserving `null`
  selection.
- Add safe run-scoped real agent fixture creation and cleanup for agents tests
  in the isolated real E2E state.
- Expand `agents` real Gateway Playwright coverage to validate:
  - shell navigation into Agents;
  - light and dark renders;
  - English and Chinese renders;
  - interactive detail sections/tabs;
  - back-to-list stability while live events are connected;
  - clean console/page/BFF error evidence.
- Update the head matrix and tasks with the strengthened agents evidence.

## Capabilities

### New Capabilities

- `frontend-agents-real-e2e-hardening`: Captures strengthened agents real E2E
  evidence and the live-selection regression fix.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Uses agents as the first sample for
  the strengthened real Gateway rubric.

## Impact

- Frontend:
  `deck-go/frontend-new/src/stores/agents.ts`,
  `deck-go/frontend-new/src/stores/__tests__/agents-store.test.ts`.
- E2E:
  `deck-go/test/e2e/agents-real-gateway.spec.ts`,
  `deck-go/test/e2e/helpers.ts`.
- OpenSpec/docs:
  head remediation artifacts and
  `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
