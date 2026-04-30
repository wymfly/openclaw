## MODIFIED Requirements

### Requirement: Run metadata bar per assistant message

The system SHALL display a compact metadata bar below each assistant message showing run-level execution information: model name, token usage, duration, and—when available—cache hit ratio and cost. Optional fields SHALL be hidden when undefined rather than rendered as placeholders.

#### Scenario: Complete run with full metadata

- **WHEN** an assistant message's run completes and the SSE agent event provides model, usage (`input`, `output`, `cacheRead`, `cacheWrite` token counts per `CostUsageTotals`), duration (computed by Deck from lifecycle start/end timestamps), and optional view-derived cache-hit ratio (`cacheHit`) and cost (mapped from wire `totalCost`)
- **THEN** a metadata bar SHALL appear below the message showing: model badge (e.g., "claude-sonnet-4.6"), token summary (e.g., "1.2k in / 3.4k out"), cache hit ratio (e.g., "cache 71%") when present, cost (e.g., "$0.018") when present, and duration (e.g., "12.3s")

#### Scenario: Streaming run (in progress)

- **WHEN** an assistant message is currently streaming
- **THEN** the metadata bar SHALL show: model badge (if known from first delta), a spinning token counter updating in real-time, and an elapsed timer
- **AND** SHALL omit cache hit and cost chips entirely until the run completes

#### Scenario: Optional cache hit field undefined

- **WHEN** the run completes but the derived cache-hit ratio is undefined (e.g., `cacheRead` and `cacheWrite` both missing, or denominator is zero)
- **THEN** the metadata bar SHALL NOT render a cache hit chip
- **AND** SHALL NOT render a placeholder ("—" or "0%") for the missing field
- **AND** the remaining chips SHALL reflow to consume the freed space

#### Scenario: Optional cost field undefined

- **WHEN** the run completes but cost is undefined in the run metadata
- **THEN** the metadata bar SHALL NOT render a cost chip
- **AND** SHALL NOT render a placeholder ("—" or "$0.000") for the missing field

#### Scenario: Partial required-field metadata

- **WHEN** the agent event does not include a baseline metadata field that is normally required (e.g., missing model or usage)
- **THEN** the metadata bar SHALL display "—" for that single missing baseline field
- **AND** SHALL NOT be hidden entirely

#### Scenario: No metadata available

- **WHEN** no run-level metadata is available for an assistant message (e.g., loaded from history without metadata)
- **THEN** the metadata bar SHALL NOT be rendered for that message

#### Scenario: Metadata bar uses design-system primitives

- **WHEN** the metadata bar renders chips, badges, or spinner
- **THEN** the implementation SHALL use atoms from `frontend-design-system` (`Chip`, `Badge`, `Spinner`)
- **AND** SHALL NOT define run-status-specific bespoke equivalents
