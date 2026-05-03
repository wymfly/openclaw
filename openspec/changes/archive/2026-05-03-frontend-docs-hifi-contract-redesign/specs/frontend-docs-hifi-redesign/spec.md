## ADDED Requirements

### Requirement: Docs handoff package defines the visual contract

The docs module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/docs/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing `DeckGoDoc*` DTOs, `/api/docs*` BFF routes, frontend API wrappers, and Go local document registry/extraction implementation as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the docs handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document document inventory loading, category filtering, query filtering, selected document detail, active-session extraction, delete confirmation, source session/agent navigation, Markdown rendering, raw payload disclosure, loading/error/empty/no-match states, and mock visual states
- **AND** unsupported or uncertain document authoring, collaborative editing, version history, vector search, ACL, retention policy, import/export, and knowledge-base source-of-truth semantics SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Docs production panel follows Deck BFF document workflows

The production docs panel SHALL render and operate from contract-backed Deck document data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Document inventory and detail are loaded

- **WHEN** `fetchDocs` and `fetchDoc` resolve with contract-shaped data
- **THEN** the panel SHALL show load state, document count, category counts, active session evidence, selected document, category, language, source session, source agent, keywords, extraction/update timestamps, Markdown content, and raw document payload
- **AND** missing optional or nullable evidence such as source session, source agent, keywords, language, timestamps, or selected detail SHALL render as unavailable evidence or empty states rather than fabricated values

#### Scenario: Filters are used

- **WHEN** an operator changes category or query filters
- **THEN** the panel SHALL show matching document rows and a no-match state when no documents match
- **AND** filters SHALL only operate on contract fields exposed by `DeckGoDoc`

#### Scenario: Active-session extraction is used

- **WHEN** an operator extracts docs from the active session
- **THEN** the panel SHALL require an active session key, call the existing `extractDocs` wrapper, refresh document inventory after success, and disclose the action result as raw evidence
- **AND** the UI SHALL label extraction as local/mock visual evidence when tested through the mock stack, not as real Gateway/LLM or knowledge-base completeness evidence

#### Scenario: Document delete is used

- **WHEN** an operator deletes the selected document
- **THEN** the panel SHALL require confirmation before calling the existing `deleteDoc` wrapper
- **AND** the panel SHALL clear confirmation state after cancel, successful delete, or selected document change

### Requirement: Docs UI aligns with the settled frontend design system

The docs panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Docs UI is rendered

- **WHEN** the docs panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose document inventory, filters, active session/extraction controls, selected document metadata, Markdown reader, source navigation, and raw evidence disclosure without overlapping text or nested decorative cards
- **AND** long document IDs, session keys, agent IDs, keywords, JSON payloads, Markdown code blocks, and action errors SHALL wrap or scroll in stable constrained regions without shifting the layout

### Requirement: Docs mock visual verification is available

The docs rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped document data without requiring a real Gateway, real LLM, real knowledge-base extraction quality, or persistent user document corpus.

#### Scenario: Mock visual E2E runs

- **WHEN** the docs mock/local visual E2E is executed
- **THEN** it SHALL load or seed documents through the normal frontend/backend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as filter detail, extraction result, delete confirmation, or raw payload evidence
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, production extraction quality, or full knowledge-base assurance
