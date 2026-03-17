## ADDED Requirements

### Requirement: Theme Selection

The deck settings panel SHALL allow the user to select a display theme: dark, light, or system (auto-detect). The preference SHALL be persisted in the SQLite `deck.db` settings table.

#### Scenario: Switch theme

- **WHEN** the user selects "dark" theme from the settings
- **THEN** the application SHALL immediately apply the dark theme and persist the preference in `deck.db`

#### Scenario: System theme auto-detect

- **WHEN** the user selects "system" theme
- **THEN** the application SHALL follow the operating system's dark/light mode preference and update automatically when the OS setting changes

### Requirement: Language Preference

The panel SHALL allow switching the UI language between Chinese (zh) and English (en) via next-intl. The preference SHALL be persisted in `deck.db`.

#### Scenario: Switch language

- **WHEN** the user selects English from the language selector
- **THEN** all UI text SHALL update to English via next-intl and the preference SHALL be persisted

### Requirement: Gateway Connection Settings

The panel SHALL allow viewing and editing the Gateway connection URL and authentication token.

#### Scenario: Update Gateway URL

- **WHEN** the user changes the Gateway URL and saves
- **THEN** the Deck Server SHALL reconnect the WebSocket adapter to the new Gateway URL

### Requirement: Version Information Display

The panel SHALL display version information for the deck, Gateway, and OpenClaw CLI.

#### Scenario: Display version info

- **WHEN** the user views the Settings panel
- **THEN** the panel SHALL display the openclaw-deck version, the connected Gateway version, and the OpenClaw CLI version

### Requirement: Notification Preferences

The panel SHALL allow configuring notification preferences (enable/disable toast categories, auto-dismiss duration).

#### Scenario: Configure notification preferences

- **WHEN** the user disables "budget alert" toast notifications
- **THEN** the toast system SHALL suppress budget alert toasts while still recording them in the activity feed
