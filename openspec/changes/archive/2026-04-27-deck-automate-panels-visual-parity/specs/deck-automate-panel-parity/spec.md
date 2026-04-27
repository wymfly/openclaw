## ADDED Requirements

### Requirement: Cron and Scheduler restore old job management workflows

The Vite Cron/Scheduler surface SHALL restore old Deck job forms, job lists, run history, run-now controls, next-execution countdown, heartbeat configuration, loading, empty, and error states.

#### Scenario: User inspects scheduled jobs

- **WHEN** a user opens the Cron or Scheduler workflow
- **THEN** the panel SHALL expose old Deck-equivalent job list, edit/create form, run history, and run-now affordances.

### Requirement: Webhooks restores form and delivery history

The Vite Webhooks panel SHALL restore old Deck webhook creation/editing, delivery history, status, validation, and feedback surfaces.

#### Scenario: User opens webhook details

- **WHEN** a user selects or edits a webhook
- **THEN** the panel SHALL show old Deck-equivalent form state and delivery history feedback.

### Requirement: Approvals restores policy and realtime review

The Vite Approvals panel SHALL restore old Deck pending approvals, plugin approvals, policy editor, path allowlist, SSE/stream status, action feedback, loading, empty, and error states.

#### Scenario: Pending approval arrives

- **WHEN** a pending approval event is available
- **THEN** the panel SHALL render old Deck-equivalent realtime pending review and action affordances.

### Requirement: Skills restores old management workspace

The Vite Skills panel SHALL restore old Deck skill list, hub tab, info tab, config tab, matrix tab, install dialog, loading, empty, and error states.

#### Scenario: User configures a skill

- **WHEN** a user selects a skill
- **THEN** the panel SHALL expose old Deck-equivalent info/config/matrix and install/configure interactions.

### Requirement: Automate panels are localized

All visible Automate panel copy SHALL switch between English and Chinese.

#### Scenario: Locale switch on Automate panel

- **WHEN** locale changes while Cron/Scheduler, Webhooks, Approvals, or Skills is active
- **THEN** panel-local headings, tabs, labels, placeholders, dialogs, errors, empty states, and buttons SHALL switch language except for proper nouns, code, identifiers, and user data.

### Requirement: Automate backend parity gaps are fixed or classified

The Vite Automate panel migration SHALL fix Go backend/API/projection gaps required by old Deck automation workflows when the Gateway source of truth supports the capability.

#### Scenario: Old automation control needs missing backend behavior

- **WHEN** Cron/Scheduler, Webhooks, Approvals, or Skills needs job, delivery, approval, policy, allowlist, stream, skill, install, or config behavior missing from the Go backend
- **THEN** the implementation SHALL update the Go backend/API adapter or document a Gateway-unsupported exception with an explicit unavailable state.
