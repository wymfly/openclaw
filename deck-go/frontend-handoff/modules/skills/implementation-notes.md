# Skills Implementation Notes

## Current baseline

- The current production panel is functional but dense and relies on global `deck-ui-skills*` styles in `theme.css`.
- The BFF and generated Gateway contract chain already covers all panel methods used in this pass.
- The bundled mock Gateway does not currently provide deterministic `skills.*` or `deck.agents.skills.*` handlers, so visual E2E must add fixture support before asserting the panel.

## Implementation constraints

- Keep browser code on the Go BFF wrappers. Do not call Gateway, ClawHub, local files, or package managers directly from React.
- Do not introduce a new schema editor, marketplace dependency solver, credential vault, or install safety model.
- Keep skill/catalog/config/matrix molecules module-local.
- Label mock visual evidence as mock/local only.

## Expected production changes

- Add `skills-panel.css` beside `SkillsPanel.tsx`.
- Remove the obsolete `deck-ui-skills*` global block from `theme.css`.
- Keep existing wrapper names and mutation envelopes.
- Update unit tests to assert the new classes and preserve behavior.
- Add `deck-go/test/e2e/skills-visual.spec.ts`.
