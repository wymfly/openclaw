# Models Interactions

## Navigation

- Tabs switch between Catalog, Provider Config, Fallbacks, and Usage without
  remounting the whole panel.
- Runtime provider rail selects a provider/model in the Catalog tab.
- Provider auth rail jumps to Provider Config for the selected provider.

## Keyboard And Focus

- All tabs are buttons with `role="tab"` and correct `aria-selected`.
- Provider/model rows and side rail rows are keyboard-focusable buttons.
- Focus rings use `--ds-accent` and must be visible in dark and light themes.
- Text never relies on hover-only visibility.

## Save And Refresh

- Refresh reloads config, runtime inventory, auth overview, catalog providers,
  usage cost, and provider pressure.
- Save submits the current raw draft with `baseHash`.
- Save result remains visible as diagnostic evidence.

## Schema Lookup

- Lookup trims the schema path before submission.
- Empty schema path shows a validation error and does not call the API.

## Provider Config

- Add provider creates an empty `models.providers.<id>` entry.
- Catalog apply fills missing defaults only; it does not overwrite already-set
  provider fields.
- Header/model editors update the raw draft and preserve unrelated fields.

## Fallbacks And Allowlist

- Fallback add/remove/move preserves other model object fields.
- Allowlist enable seeds current primary/fallback refs.
- Disabling the allowlist removes `agents.defaults.models` and preserves the rest
  of `agents.defaults`.

## Probe

- Probe calls the existing provider probe wrapper.
- Probe result is shown as evidence; it does not automatically save config.

## Disabled States

- Buttons are disabled while save/probe/lookup is active.
- Catalog actions are disabled when no catalog model is selected.
