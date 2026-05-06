# frontend-identity-hifi-redesign Specification

## Purpose

Defines the high-fidelity, contract-backed Identity redesign for Deck BFF canonical identity relationships, peer mappings, config-hash guarded link/unlink mutations, mutation recovery states, mock/local visual verification, and design-system rollout evidence.

## Requirements

### Requirement: Identity handoff package defines the visual contract

The identity module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/identity/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing identity wrappers, `/api/deck/identity` BFF route, `DeckGoIdentity*` DTOs, generated Gateway methods, and `configHash`/`baseHash` mutation guard as the source truth, and it SHALL call out every place where the v2 prototype is product guidance rather than code truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the identity handoff package is reviewed for implementation
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, `api-usage.md`, and implementation notes for the revised v2 handoff
- **AND** the package SHALL document canonical identity inventory, selected canonical detail, peer mapping rows, channel mix, config-hash evidence, link dialog, confirmed unlink, missing-hash guard, failed-mutation refresh, last-action feedback, raw payload disclosure, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain rename/create/delete canonical, peer activity enrichment, recent mutation audit, bulk merge, split, deduplicate, trust, identity proofing, channel lookup, directory sync, and production audit semantics SHALL be documented as follow-up rather than silently fabricated in the UI
- **AND** stale route or method names SHALL be corrected to current code truth when discovered

### Requirement: Identity production panel follows Deck BFF relationship workflows

The production identity panel SHALL render and operate from contract-backed Deck identity relationship data while preserving the existing panel registry and API facade boundaries. The production implementation SHALL treat the refreshed handoff as the visual target, but it SHALL follow code truth: identity list/link/unlink are Deck BFF routes backed by generated Gateway methods, agent identity is a separate route, rename/create/delete canonical are unsupported unless a matching contract is added, and peer activity/recent mutation history are projections that may be absent.

#### Scenario: Identity relationships are loaded

- **WHEN** `fetchIdentityLinks` resolves with contract-shaped data
- **THEN** the panel SHALL show canonical count, peer count, channel mix, selected canonical identity, selected peer mappings, config-hash status, last action, error state, and raw payload evidence
- **AND** missing optional fields such as `configHash`, peers, channel labels, activity metadata, recent mutations, last action, or raw payload fields SHALL render as unavailable, blocked, empty, or omitted evidence rather than fabricated values

#### Scenario: Identity link mutation is used

- **WHEN** an operator submits a canonical, channel, and peer ID through the link workflow
- **THEN** the panel SHALL trim submitted values and call `linkIdentityPeer` with the current `configHash` as `baseHash`
- **AND** incomplete drafts SHALL remain blocked from submission
- **AND** missing `configHash` SHALL block the mutation and show the configured hash-required copy
- **AND** a failed link mutation SHALL refresh identity links so the next visible hash and relationship state reflect the backend response

#### Scenario: Identity unlink mutation is used

- **WHEN** an operator unlinks a peer from the selected detail or peer badge workflow
- **THEN** the panel SHALL ask for explicit confirmation before calling `unlinkIdentityPeer`
- **AND** it SHALL call `unlinkIdentityPeer` with the selected canonical, peer channel, peer ID, and current `configHash` as `baseHash`
- **AND** missing `configHash` SHALL block the mutation before confirmation
- **AND** a cancelled confirmation SHALL NOT call the mutation wrapper

#### Scenario: Prototype-only identity mutations are reviewed

- **WHEN** the handoff package references rename canonical, create canonical, delete canonical, peer activity, recent mutation audit, profile/API-key/session management, or directory synchronization
- **THEN** production SHALL keep those workflows disabled, omitted, degraded, or documented unless a matching Deck-facing contract or verified BFF route exists
- **AND** unresolved workflow assumptions SHALL be recorded in `deck-go/frontend-handoff/modules/identity/implementation-notes.md`

### Requirement: Identity UI aligns with the settled frontend design system

The identity panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Identity UI is rendered

- **WHEN** the identity panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose identity metrics, canonical inventory, selected canonical evidence, peer mappings, mutation safety, link/unlink controls, last-action/error feedback, and raw payload access without overlapping text or nested decorative cards
- **AND** long canonical names, channel IDs, peer IDs, hash values, error messages, and raw payload labels SHALL wrap or truncate in stable constrained regions without shifting the layout
- **AND** all labels, buttons, empty states, validation messages, and mutation statuses SHALL be localizable through `frontend-new/src/i18n/{en,zh}.json`

### Requirement: Identity mock visual verification is available

The identity rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped identity data without requiring a real Gateway, real identity provider, contact directory, LLM, or external channel account.

#### Scenario: Mock visual E2E runs

- **WHEN** the identity mock/local visual E2E is executed
- **THEN** it SHALL load identity links through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least two interaction states such as selected canonical detail, link dialog, missing-hash guard, unlink confirmation path, mutation feedback, raw payload expansion, or unsupported rename/create/delete disabled state
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, identity provider proofing, contact directory sync, or production audit assurance
