## ADDED Requirements

### Requirement: deck.identity.list returns structured identity links

The system SHALL read `config.session.identityLinks` (format: `Record<string, string[]>` with `"channel:peerId"` values) and return a structured view with separate `channel` and `peerId` fields.

#### Scenario: List identity links

- **WHEN** client calls `deck.identity.list` and config has `identityLinks: { alice: ["telegram:123", "discord:456"] }`
- **THEN** system returns `links: [{ canonical: "alice", peers: [{ channel: "telegram", peerId: "123" }, { channel: "discord", peerId: "456" }] }]` and `configHash`

#### Scenario: No identity links configured

- **WHEN** client calls `deck.identity.list` and no identityLinks exist
- **THEN** system returns `links: []` and `configHash`

### Requirement: deck.identity.link adds a peer to a canonical identity

The system SHALL append `"channel:peerId"` to `config.session.identityLinks[canonical]`, creating the canonical entry if it does not exist. The operation SHALL require `baseHash`.

#### Scenario: Link new peer

- **WHEN** client calls `deck.identity.link({ canonical: "alice", channel: "slack", peerId: "U789", baseHash })`
- **THEN** system appends `"slack:U789"` to `identityLinks["alice"]` and returns `ok: true` with new `configHash`

#### Scenario: Link duplicate peer

- **WHEN** client calls `deck.identity.link` with a channel:peerId that already exists for the canonical
- **THEN** system returns `ok: true` without creating a duplicate entry

### Requirement: deck.identity.unlink removes a peer from a canonical identity

The system SHALL remove `"channel:peerId"` from `config.session.identityLinks[canonical]`. The operation SHALL require `baseHash`.

#### Scenario: Unlink existing peer

- **WHEN** client calls `deck.identity.unlink({ canonical: "alice", channel: "telegram", peerId: "123", baseHash })`
- **THEN** system removes `"telegram:123"` from `identityLinks["alice"]` and returns `ok: true` with new `configHash`

### Requirement: deck.threads.list returns active thread bindings

The system SHALL read Discord thread binding persistence files and return active thread bindings. Initially only Discord channel data is available.

#### Scenario: List active Discord thread bindings

- **WHEN** client calls `deck.threads.list({ channel: "discord", status: "active" })`
- **THEN** system returns thread bindings with `threadId`, `channelId`, `agentId`, `targetSessionKey`, `targetKind`, `boundAt`, `lastActivityAt`

#### Scenario: List threads for unsupported channel

- **WHEN** client calls `deck.threads.list({ channel: "telegram" })`
- **THEN** system returns `threads: []` (Telegram has no thread binding support)
