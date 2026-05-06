## MODIFIED Requirements

### Requirement: Docs production panel follows Deck BFF document workflows

The production docs panel SHALL render and operate from contract-backed Deck document data while preserving the existing panel registry and API facade boundaries. The refreshed v2 handoff SHALL be used as the visual/product target only where it is consistent with those contracts.

#### Scenario: Document inventory and detail are loaded

- **WHEN** `fetchDocs` and `fetchDoc` resolve with contract-shaped data
- **THEN** the panel SHALL show load state, document count, category counts, selected document, category, language, source session, source agent, keywords, extraction/update timestamps, Markdown content, related/provenance evidence where contract-backed, and raw document payload
- **AND** missing optional or nullable evidence such as source session, source agent, keywords, language, timestamps, or selected detail SHALL render as unavailable evidence or empty states rather than fabricated values
- **AND** the inventory rail and selected document workspace SHALL follow the refreshed v2 handoff unless doing so would hide contract-backed state

#### Scenario: Filters and search are used

- **WHEN** an operator changes category, query, keyword, or search filters
- **THEN** the panel SHALL show matching document rows and a no-match state when no documents match
- **AND** filters SHALL only operate on contract fields exposed by `DeckGoDoc`
- **AND** any global search overlay or keyboard shortcut SHALL remain frontend-local and SHALL NOT imply a server-side docs search endpoint unless such endpoint exists

#### Scenario: Active-session extraction is used

- **WHEN** an operator extracts docs from the active session
- **THEN** the panel SHALL require an active session key, call the existing `extractDocs` wrapper, refresh document inventory after success, and disclose the action result as raw evidence
- **AND** the UI SHALL label extraction as local/mock visual evidence when tested through the mock stack, not as real Gateway/LLM or knowledge-base completeness evidence

#### Scenario: Document delete is used

- **WHEN** an operator deletes the selected document
- **THEN** the panel SHALL require confirmation before calling the existing `deleteDoc` wrapper
- **AND** the panel SHALL clear confirmation state after cancel, successful delete, or selected document change
- **AND** real-stack verification SHALL avoid deleting user docs unless it creates and owns a disposable fixture

### Requirement: Docs UI aligns with the settled frontend design system

The docs panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Docs UI is rendered

- **WHEN** the docs panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose document inventory, filters/search, extraction controls, selected document metadata, Markdown reader, source/provenance navigation, related evidence where contract-backed, and raw evidence disclosure without overlapping text or nested decorative cards
- **AND** long document IDs, session keys, agent IDs, keywords, JSON payloads, Markdown code blocks, and action errors SHALL wrap or scroll in stable constrained regions without shifting the layout
- **AND** v2 local molecules such as category rows, keyword chips, search result rows, Markdown viewer, confirm rows, and related doc cards SHALL either map to existing atoms/patterns or remain module-local
