## ADDED Requirements

### Requirement: Channel List Display

The channel configuration panel SHALL display all channels in two groups: configured (linked) channels and available (unconfigured) channels, using the `channels.status` Gateway RPC.

#### Scenario: Display configured and available channels

- **WHEN** the user navigates to the Channels panel
- **THEN** the panel SHALL call `channels.status` and display configured channels with status indicators (linked / error) in the primary section, and available but unconfigured channels in a secondary section

### Requirement: Per-Channel Status Indicator

Each channel entry SHALL display a status indicator showing its current state: linked, error, or unconfigured.

#### Scenario: Channel status display

- **WHEN** a channel is displayed in the list
- **THEN** it SHALL show a colored status badge (green=linked, red=error, gray=unconfigured) with a brief status message

### Requirement: Channel Configuration Forms

The panel SHALL provide per-channel configuration forms (token, webhook URL, phone number, etc.) that write to the OpenClaw configuration via `config.set` and `config.patch` RPCs.

#### Scenario: Configure channel credentials

- **WHEN** the user enters a bot token for a Telegram channel and saves
- **THEN** the panel SHALL call `config.patch` to persist the credential and the channel status SHALL update upon next status check

### Requirement: Channel Enable/Disable

The panel SHALL support enabling and disabling channels, and re-linking channels that are in an error state.

#### Scenario: Disable a channel

- **WHEN** the user clicks "Disable" on a configured channel
- **THEN** the panel SHALL update the configuration via `config.patch` to disable the channel and its status SHALL change to "unconfigured"

#### Scenario: Re-link errored channel

- **WHEN** the user clicks "Re-link" on a channel in error state
- **THEN** the panel SHALL call `channels.logout` followed by re-applying the channel configuration via `config.set` to attempt re-establishment
