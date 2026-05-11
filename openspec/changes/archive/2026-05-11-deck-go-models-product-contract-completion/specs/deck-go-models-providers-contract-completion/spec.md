## MODIFIED Requirements

### Requirement: Models typed actions SHALL extend contract completion evidence

Deck Go SHALL extend Models/Providers contract completion from raw config save and provider probe coverage to typed Models config detail and typed provider/model/mode actions.

#### Scenario: Typed Models action is production-visible

- **WHEN** provider upsert, provider delete preview, provider delete commit, model upsert, model delete preview, model delete commit, or mode set is exposed to the frontend
- **THEN** the action SHALL have a Deck-facing DTO, frontend facade or mutation hook, mutation evidence metadata, owner module, route/action id, response success indicator, fixture safety status, and real-evidence status.

#### Scenario: Raw config save route remains outside normal Models UI

- **WHEN** `models.config.save` remains in contracts or backend code for compatibility, generic config tooling, or historical evidence
- **THEN** normal Models provider/model CRUD SHALL not depend on it
- **AND** the Models page SHALL not expose it as a product action or describe it as the fallback path for unsupported fields.

#### Scenario: Unsupported Models workflow is visible in design

- **WHEN** a Models workflow depends on unsupported rate limits, OAuth runner behavior, secret-value store CRUD, audit history, rollback, raw provider `request` editing, model `compat` editing, or unsafe provider calls
- **THEN** the workflow SHALL be marked unsupported, skipped-safe, degraded, or follow-up-blocked rather than product-complete.

### Requirement: Models contract completion SHALL include handoff and UI evidence

Deck Go SHALL keep Models contract truth, frontend product implementation, and handoff prototype synchronized.

#### Scenario: Handoff is updated

- **WHEN** the typed Models control plane is implemented
- **THEN** `deck-go/frontend-handoff/modules/models` SHALL document the final product IA, component tree, states, interactions, API usage, implementation notes, and raw-editor removal from the Models product path
- **AND** it SHALL state that OpenClaw config truth overrides older decorative prototype assumptions.

#### Scenario: Frontend evidence is recorded

- **WHEN** Models frontend implementation is marked complete
- **THEN** focused component tests, mock E2E or visual smoke evidence, build/typecheck evidence, and real-safe route evidence where available SHALL prove the visible typed workflows, usage-policy overview, raw-editor absence, and edge states.
