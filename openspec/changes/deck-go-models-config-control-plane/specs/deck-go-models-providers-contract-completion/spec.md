## ADDED Requirements

### Requirement: Models typed actions SHALL extend contract completion evidence

Deck Go SHALL extend Models/Providers contract completion from raw config save and provider probe coverage to typed Models config detail and typed provider/model/mode actions.

#### Scenario: Typed Models action is production-visible

- **WHEN** provider upsert, provider delete preview, provider delete commit, model upsert, model delete preview, model delete commit, or mode set is exposed to the frontend
- **THEN** the action SHALL have a Deck-facing DTO, frontend facade or mutation hook, mutation evidence metadata, owner module, route/action id, response success indicator, fixture safety status, and real-evidence status.

#### Scenario: Raw config save remains available

- **WHEN** `models.config.save` remains in the product
- **THEN** its metadata and UI usage SHALL identify it as an advanced fallback for raw/low-level config editing
- **AND** normal provider/model CRUD SHALL not be considered complete if it still depends on raw full-config submission.

#### Scenario: Unsupported Models workflow is visible in design

- **WHEN** a Models workflow depends on unsupported rate limits, OAuth runner behavior, secret-value store CRUD, audit history, rollback, or unsafe provider calls
- **THEN** the workflow SHALL be marked unsupported, skipped-safe, degraded, or follow-up-blocked rather than product-complete.

### Requirement: Models contract completion SHALL include handoff and UI evidence

Deck Go SHALL keep Models contract truth, frontend product implementation, and handoff prototype synchronized.

#### Scenario: Handoff is updated

- **WHEN** the typed Models control plane is implemented
- **THEN** `deck-go/frontend-handoff/modules/models` SHALL document the final product IA, component tree, states, interactions, API usage, and implementation notes
- **AND** it SHALL state that OpenClaw config truth overrides older decorative prototype assumptions.

#### Scenario: Frontend evidence is recorded

- **WHEN** Models frontend implementation is marked complete
- **THEN** focused component tests, mock E2E or visual smoke evidence, and build/typecheck evidence SHALL prove the visible typed workflows and edge states.
