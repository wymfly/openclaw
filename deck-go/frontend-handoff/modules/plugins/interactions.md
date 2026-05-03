# Plugins Interactions

## Keyboard And Focus

- Inventory rows are buttons and keep visible focus rings.
- Scope controls are buttons with `aria-pressed`.
- Raw payload uses native `details`/`summary`.
- Related handoff actions are real buttons.

## Scope Switch

Selecting "Channel plugins" or "All plugins" reloads through
`fetchPluginsWithCapability`. The selected plugin is preserved when still
present.

## Selection

Selecting a row updates selected detail and raw payload. Selection does not
mutate plugin state.

## Cross-Panel Handoffs

Handoff buttons call existing panel-navigation helpers:

- Channels for visible channel IDs
- Routing for the first visible channel ID
- Channels access controls for visible WeCom channel IDs

The UI shows a local message after handoff. This is navigation evidence, not a
plugin mutation result.

## Hidden Channels

Hidden channel IDs are shown as warning copy. They must not receive unsupported
handoff buttons.

## Visual Constraints

- No horizontal overflow at 1440px or mobile widths.
- Long plugin IDs, config paths, capability lists, and diagnostics wrap inside
  stable regions.
- Mock/local evidence must not be labeled as real lifecycle, marketplace, or
  activation assurance.
