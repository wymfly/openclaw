# Follow-up: Agents 11-section Prototype Refresh

## Source

`openspec/changes/deck-go-agents-section-ia-convergence`

## Facts

- The implemented Agents module now uses the accepted 11-section detail IA and 7-section defaults editor.
- Existing frontend-handoff prototypes were created before this final IA and do not represent the accepted product surface.
- Mock E2E and real Gateway E2E passed against the implemented UI, so this is not a code-blocking gap.

## Classification

frontend-handoff / visual-reference / non-blocking

## Suggested Next Step

Create or update `deck-go/frontend-handoff/modules/agents/` so the handoff package describes the final 11-section IA, defaults editor, guarded impact flows, unresolved refs modal, source badges, and cross-module link-out behavior.

## Needs New OpenSpec?

Optional. Use a small OpenSpec or lightweight plan only if the refresh also changes production UI.

## Acceptance Hints

- Prototype or handoff README lists all 11 detail sections and 7 defaults sections.
- It records that production truth is `frontend-new` + accepted OpenSpec, not the older prototype.
- It links the mock/real E2E evidence from the archived change.

## Status

deferred
