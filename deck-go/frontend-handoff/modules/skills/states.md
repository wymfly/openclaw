# Skills States

## Load states

- `idle`: no request has completed; show neutral readiness and loading affordances.
- `loading`: inventory or matrix refresh is in progress; keep the prior data visible where available.
- `ready`: skill inventory and matrix have resolved.
- `error`: show the wrapper error in the relevant surface without clearing unrelated successful data.

## Inventory states

- Empty: `skills[]` is missing or empty; show an empty inventory message and keep hub/matrix controls available if their data exists.
- Filtered empty: search/status filter hides every skill; show a filtered-empty message.
- Selected missing after refresh: fall back to preferred key when available, otherwise current key if still present, otherwise first skill.
- Missing optional fields: render `n/a` for source/detail values rather than inventing data.

## Selected skill states

- Ready skill: show status, source, enabled state, primary env, description, requirement evidence, config editor, install options, and raw payload.
- Needs setup: emphasize missing env/config/bin/os requirements and primary env.
- Disabled: enable action is primary; config remains inspectable.
- Install options absent: hide the install-options surface.
- Config JSON invalid: keep the draft visible and show a save error without calling the mutation wrapper.

## ClawHub states

- Bins loaded: show bin chips as search shortcuts.
- Search idle: prompt the operator to search ClawHub.
- Search loading: disable search and keep query visible.
- Results ready: show result rows with slug, version, summary, and score/updated evidence when present.
- Detail loading: keep the selected result context visible if possible.
- Detail ready: show package identity, version, owner, platforms, changelog, and install action.
- Hub action result: show raw result after install/update; do not replace installed inventory until refresh resolves.

## Matrix states

- Matrix loading: keep current matrix if present and disable toggles.
- Agent missing config: show `n/a` cell.
- Agent mode `all`: show read-only all-skills coverage.
- Agent mode `whitelist`: show included/excluded toggle cells.
- Toggle in flight: disable other matrix cells and show updating in the active cell.
- Matrix action result: show raw mutation output and update the local matrix with returned `skills` and `configHash`.

## Visual E2E states

The mock visual test should cover:

- ready workbench
- selected skill switch
- config save or install option result
- ClawHub search/detail/install or update result
- matrix toggle result
