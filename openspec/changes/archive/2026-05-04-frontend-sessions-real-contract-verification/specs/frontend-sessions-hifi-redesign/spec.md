## ADDED Requirements

### Requirement: Sessions handoff distinguishes product target from verified contract truth

The Sessions high-fidelity handoff SHALL separate product intent from currently
verified session inventory, preview, detail, history, usage, compaction,
lineage, mutation, cache, export, and frontend behavior.

#### Scenario: Handoff notes record verified and projected behavior

- **WHEN** the Sessions real-contract verification pass completes
- **THEN** the handoff package SHALL record which workflows are supported by
  current wrappers, routes, DTOs, mocks, and tests
- **AND** server-side cursor pagination, exhaustive patch schema fields,
  real-time panel refresh, and destructive real Gateway mutation proof SHALL be
  labelled as projected, degraded, unsupported, skipped-safe, or
  handoff-blocked rather than guaranteed
- **AND** route truth SHALL distinguish current BFF routes from direct Gateway
  method names and prototype-only UI assumptions
