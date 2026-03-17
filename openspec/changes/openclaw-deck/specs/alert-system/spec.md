## ADDED Requirements

### Requirement: Alert Rule CRUD

The alert system SHALL support creating, reading, updating, and deleting alert rules. Each rule SHALL specify an entity type, condition, threshold, and action. Rules SHALL be persisted in the SQLite projection store.

#### Scenario: Create an alert rule

- **WHEN** the user creates an alert rule with entity type (agent/session/budget), condition (e.g., "tokens > X"), threshold value, and notification action
- **THEN** the panel SHALL persist the rule in SQLite and begin evaluating it against incoming events

#### Scenario: Delete an alert rule

- **WHEN** the user confirms deletion of an alert rule
- **THEN** the panel SHALL remove the rule from SQLite and stop evaluating it

### Requirement: Condition Engine

The alert system SHALL evaluate alert conditions against real-time EventBus events and trigger actions when conditions are met.

#### Scenario: Condition trigger

- **WHEN** an EventBus event matches an alert rule's entity type and the metric exceeds the threshold
- **THEN** the system SHALL fire the alert action (toast notification, activity feed entry) and record the firing timestamp

### Requirement: Cooldown Periods

Each alert rule SHALL support a configurable cooldown period during which the same rule SHALL NOT fire again after triggering.

#### Scenario: Cooldown enforcement

- **WHEN** an alert rule fires and has a 5-minute cooldown configured
- **THEN** the system SHALL suppress duplicate firings of the same rule for 5 minutes, even if the condition remains true

### Requirement: Notification Routing

The alert system SHALL route alert notifications to configured destinations: toast notifications (in-browser), activity feed entries, and optionally webhook delivery.

#### Scenario: Route to toast notification

- **WHEN** an alert fires with toast notification routing configured
- **THEN** the system SHALL emit a toast notification of type "warning" with the alert rule name and triggered condition details

#### Scenario: Route to activity feed

- **WHEN** an alert fires
- **THEN** the system SHALL always create an activity feed entry for the alert event regardless of other routing configuration
