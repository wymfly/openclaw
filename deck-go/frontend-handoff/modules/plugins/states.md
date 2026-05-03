# Plugins States

## Load States

- `idle`: no inventory loaded yet or load failed before a ready response.
- `loading`: plugin inventory request is in progress.
- `ready`: current inventory came from `fetchPluginsWithCapability`.

## Capability Scope

- `channel`: default inventory scope for channel-capable plugins.
- `all`: full plugin inventory when the operator selects "All plugins".

Changing scope reloads plugin inventory and preserves the selected plugin when
the next payload still contains it.

## Selection State

The selected plugin is:

1. the `pluginId` URL navigation target when present in the payload,
2. the previous selected plugin when it still exists,
3. otherwise the first plugin in the payload.

## Empty State

When `plugins.length === 0`, show the inventory empty message and selected
detail hint. Do not fabricate plugin rows.

## Error State

Errors are displayed inline above the workspace. Current inventory may remain
visible if already loaded.

## Related Channel State

- Visible channel IDs get Channels/Routing handoff buttons.
- WeCom visible channel IDs also get Access handoff buttons.
- Hidden channel IDs are labeled as not visible in Channels.

## Diagnostic State

Diagnostics render as level/message rows. Missing diagnostics render a no
diagnostics message.

## Lifecycle Limitation State

Always show that lifecycle controls are deferred. Do not add install, uninstall,
enable, disable, reload, trust, marketplace, or package-signature controls.

## Mock/Local Visual States

The visual E2E should cover:

- ready workbench with seeded plugins
- selected plugin detail
- hidden channel warning
- handoff message or scope switch
- raw payload disclosure
