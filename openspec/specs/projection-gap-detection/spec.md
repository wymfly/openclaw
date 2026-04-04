# projection-gap-detection Specification

## Purpose

TBD - created by archiving change deck-projection-platform. Update Purpose after archive.

## Requirements

### Requirement: getEventsSince SHALL signal when events have been pruned

The `getEventsSince()` method SHALL return a gap detection flag alongside the event list, indicating whether the requested checkpoint falls before the oldest surviving outbox event.

#### Scenario: No gap — all requested events available

- **WHEN** `getEventsSince(lastId)` is called
- **AND** `lastId` is greater than or equal to the minimum `id` in the outbox table (or the outbox is empty)
- **THEN** the method SHALL return `{ events: OutboxEntry[], gapDetected: false }`

#### Scenario: Gap detected — events have been pruned

- **WHEN** `getEventsSince(lastId)` is called
- **AND** `lastId > 0` and `lastId` is less than the minimum `id` in the outbox table
- **THEN** the method SHALL return `{ events: OutboxEntry[], gapDetected: true }`
- **AND** the `events` array SHALL contain events starting from the oldest surviving entry

#### Scenario: First connection — no prior checkpoint

- **WHEN** `getEventsSince(0)` is called (lastId = 0, indicating no prior checkpoint)
- **THEN** `gapDetected` SHALL be `false` regardless of outbox state

### Requirement: SSE stream SHALL emit a gap event when replay gap is detected

The `/api/stream` SSE endpoint SHALL emit a `projection.gap` event when the durable outbox replay detects a gap.

#### Scenario: Gap event emitted on reconnect with pruned events

- **WHEN** a client reconnects with a `Last-Event-ID` header
- **AND** the durable outbox replay returns `gapDetected: true`
- **THEN** the stream SHALL emit an SSE event with `event: projection.gap` and `data: {"reason":"events_pruned"}` before replaying available events

#### Scenario: No gap event when replay is complete

- **WHEN** a client reconnects with a `Last-Event-ID` header
- **AND** the durable outbox replay returns `gapDetected: false`
- **THEN** the stream SHALL NOT emit a `projection.gap` event

#### Scenario: Gap event is non-breaking for existing clients

- **WHEN** a client that does not handle `projection.gap` events receives one
- **THEN** the EventSource API SHALL ignore the unknown event type per the SSE specification, causing no errors or behavioral changes
