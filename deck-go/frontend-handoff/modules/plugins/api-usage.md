# Plugins API Usage

## Source Of Truth

The plugins module consumes Deck BFF plugin inventory contracts. The browser
never calls Gateway directly.

## Endpoints

### `GET /api/deck/plugins`

Returns channel-capable plugin inventory by default.

### `GET /api/deck/plugins?capability=all`

Returns all plugin inventory supported by Gateway `deck.plugins.list`.

Example response:

```json
{
  "scope": "workspace",
  "plugins": [
    {
      "id": "github",
      "name": "GitHub",
      "version": "1.2.3",
      "status": "ready",
      "origin": "bundled",
      "enabled": true,
      "activationSource": "config",
      "activationReason": "channel enabled in config",
      "configPath": "plugins.entries.github.config",
      "capabilityKinds": ["channel", "tool"],
      "channelIds": ["github", "teams"],
      "providerIds": ["github-provider"],
      "toolNames": ["issues.search"],
      "deckActionCapabilities": { "login": true, "probe": true },
      "diagnostics": [{ "level": "warn", "message": "token missing" }]
    }
  ]
}
```

### `GET /api/channels`

Used only to decide whether related channel handoff buttons are safe to show.

## Frontend Wrappers

- `fetchPluginsWithCapability(capability)`
- `fetchChannels()`

## Unsupported Semantics

- No install/uninstall mutation.
- No enable/disable/reload mutation.
- No marketplace or trust source.
- No package signature verification.
- No production activation assurance.
