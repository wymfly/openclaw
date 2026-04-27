## ADDED Requirements

### Requirement: Visual parity requires reference evidence

Each migrated panel SHALL have reference evidence comparing old Next Deck and Vite Deck on desktop Web.

#### Scenario: Panel is marked complete

- **WHEN** a panel is marked visually migrated
- **THEN** the evidence SHALL include old authority file mapping, current target file mapping, desktop screenshot evidence, i18n switch evidence, and interaction checklist results.

### Requirement: Browser validation uses the managed local stack

Visual validation SHALL run against the Go backend and managed local Gateway stack, not against deprecated CLI smoke scripts.

#### Scenario: E2E visual validation runs

- **WHEN** browser validation is performed for this migration
- **THEN** it SHALL use the established Playwright/browser plugin path with the Go backend managing Gateway health and startup.

### Requirement: Non-parity exceptions are tracked

Any intentional deviation from old Deck visual or interaction behavior SHALL be documented with rationale.

#### Scenario: Vite behavior differs from old Deck

- **WHEN** a migrated panel intentionally differs from old Deck
- **THEN** the child change SHALL record the difference, the reason, and whether it is a Gateway/API constraint, desktop-only scope decision, or future redesign deferral.
