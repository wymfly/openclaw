# routing - implementation notes

## Production translation

- `RoutingPanel` was translated into a `routing-panel` workbench rather than the old `deck-ui-routing` two-card shell.
- API wrappers were preserved: `fetchRoutingBindings`, `validateRoutingBinding`, `addRoutingBinding`, `removeRoutingBinding`, `simulateRouting`, and `patchDeckConfig`.
- Raw `/deck/routing` action strings remain in `src/api.ts` and tests, not view code.
- Unit tests were kept focused on existing behavior: load, filter, simulation normalization, validation/add/remove, reorder, selection-to-simulation, navigation, i18n, and Gateway-not-configured activity handling.

## Intentional divergences from prototype

- The production UI uses existing i18n strings where possible instead of adding every prototype label.
- Activity remains sourced from the shared activity endpoint and may be empty in mock visual runs because the mock gateway does not publish runtime bus events.
- Reorder keeps the existing remove-plus-add flow because there is no first-class contract action for reorder.

## Design-system feedback

- Routing repeats the agents metric tile, workbench rhythm, selected hero, and compact row pattern.
- These remain module-local in this change. Subagents should be used as the third data point before promoting a shared pattern.
- No new canonical atoms or tokens were required.
