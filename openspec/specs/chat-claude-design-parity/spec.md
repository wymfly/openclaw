# chat-claude-design-parity Specification

## Purpose

TBD - created by archiving change frontend-chat-parity-and-foundation-audit. Update Purpose after archive.

## Requirements

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

### Requirement: Chat workbench embedding inside Deck shell

The chat panel SHALL render as an edge-to-edge workbench inside the `frontend-new` Deck shell. The global nav rail and header SHALL remain present, but the active chat panel SHALL use a workbench content mode with no extra `deck-ui-content` padding and no redundant outer card border/radius/shadow around `ds-chat-shell`.

#### Scenario: Chat panel is active on desktop

- **WHEN** the active panel is `chat` at a desktop viewport
- **THEN** the Deck shell SHALL keep the nav rail and header visible
- **AND** the chat workbench SHALL fill the remaining content viewport height and width
- **AND** `ds-chat-shell` SHALL use internal column separators for sidebar/main/right drawer rather than an extra outer card chrome

#### Scenario: Non-chat panel is active

- **WHEN** any panel other than `chat` is active
- **THEN** the existing `deck-ui-content` padding and overflow behavior SHALL remain unchanged

### Requirement: Console-clean chat visual route

The mock-backed `chat-rich` visual route SHALL be covered by Playwright evidence that captures a screenshot and fails on unexpected `console.error` or `pageerror` events. Known-safe iframe noise MAY be filtered only when the exact message and justification are recorded in the parity gap report.

#### Scenario: Visual route emits React DOM nesting errors

- **WHEN** Playwright opens `?surface=deck-ui&panel=chat&deckVisualState=chat-rich` in dark theme with expanded nav
- **AND** React logs an invalid DOM nesting error
- **THEN** the visual E2E SHALL fail
- **AND** the implementation SHALL be fixed before refreshing visual baselines

#### Scenario: Visual route emits iframe page errors

- **WHEN** the visual route emits a `pageerror` from a canvas or artifact iframe
- **THEN** the error SHALL be fixed if it comes from deck-go-controlled visual seed code
- **OR** filtered only if the report documents that it is browser sandbox noise that cannot affect the parent Deck UI

### Requirement: Interactive row composition

Design-system row/list atoms consumed by chat SHALL NOT render nested interactive elements. A row with a selectable body and a trailing action SHALL expose separate interactive regions while preserving keyboard selection behavior and trailing action click isolation.

#### Scenario: Sidebar row has a delete IconButton

- **WHEN** `SessionSidebar` renders a session row with a trailing delete `IconButton`
- **THEN** the resulting DOM SHALL NOT contain a `<button>` descendant inside another `<button>`
- **AND** pressing Enter or Space on the row-selection control SHALL select the session
- **AND** clicking the trailing delete action SHALL open delete confirmation without selecting the row
