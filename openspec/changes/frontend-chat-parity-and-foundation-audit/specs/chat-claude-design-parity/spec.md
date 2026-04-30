## ADDED Requirements

### Requirement: Bundle parity gate for chat surfaces

Every chat-surface change in `deck-go/frontend/src/components/panels/chat/` SHALL pass a class-by-class diff against the corresponding bundle JSX in `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/{app,composer,right-panel,transcript,blocks}.jsx`, where each bundle `className` and structural primitive is either reproduced in deck-go or recorded with a justified divergence in `docs/design-bundles/2026-04-29-claude-design-chat-pilot/chat-parity-gap-report.md`.

#### Scenario: New chat surface change introduces a primitive not in bundle

- **WHEN** a developer adds a new sub-component to a chat surface that has no counterpart in the bundle JSX
- **THEN** the developer SHALL add an entry to the parity gap report explaining why the divergence is acceptable (e.g., "deck-go-specific telemetry strip with no bundle equivalent")
- **AND** the gap report SHALL be reviewed before the change merges

#### Scenario: Bundle primitive missing from deck-go

- **WHEN** the parity audit identifies a bundle className not present in deck-go (e.g., `cp-iframe-mock`)
- **THEN** the audit SHALL classify it as either `port` (will be implemented), `skip` (deck has alternative noted in report), or `deferred` (tracked as follow-up issue)
- **AND** every `skip` or `deferred` SHALL include a one-line justification in the gap report

### Requirement: Visual regression baseline refresh on chat changes

After any chat-surface visual change, the deck-baseline PNG set at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/deck-baseline/` SHALL be refreshed via `Playwright` capture at 1440×900 viewport against `?deckVisualState=chat-rich` and `?deckVisualState=chat-empty`, plus `[data-density="compact"]` toggle and `[data-theme="light"]` toggle variants.

#### Scenario: Atom CSS change touches a chat surface

- **WHEN** a CSS atom change ships that visually affects a chat surface
- **THEN** the developer SHALL re-capture the four baseline screenshots (chat-rich, chat-empty, chat-rich-compact, chat-rich-light)
- **AND** commit them to the deck-baseline directory with the change

#### Scenario: Bundle is updated to a newer Claude Design iteration

- **WHEN** a new bundle ships at `docs/design-bundles/<new-date>-claude-design-chat-pilot/`
- **THEN** the parity gate SHALL be re-run against the new bundle JSX
- **AND** the deck-baseline PNG set SHALL move under the new bundle directory
- **AND** the prior bundle directory SHALL be retained as historical reference

### Requirement: Bundle hash lock for parity gate

The parity gap report SHALL record the SHA-256 hash of each bundle JSX file (composer.jsx, right-panel.jsx, transcript.jsx, blocks.jsx, app.jsx) at the time of audit, so that future bundle iterations are detectable as audit-invalidating events.

#### Scenario: Bundle JSX changes between audits

- **WHEN** any bundle JSX file's SHA-256 hash differs from the recorded value in the gap report
- **THEN** the parity gate SHALL be marked stale
- **AND** the next chat-surface change SHALL trigger a re-audit before being allowed to merge
