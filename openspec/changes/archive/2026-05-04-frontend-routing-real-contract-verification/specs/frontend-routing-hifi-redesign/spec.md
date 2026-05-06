## MODIFIED Requirements

### Requirement: Routing production panel follows contract-backed workflows

The production routing panel SHALL render and operate from contract-backed routing list, validation, mutation, simulation, DM scope patch, and activity data while preserving the existing `frontend-new` panel registry and API facade boundaries. The refreshed v2 handoff SHALL be used as the visual/product target only where it is consistent with those contracts.

#### Scenario: Routing bindings are loaded

- **WHEN** `fetchRoutingBindings` returns `DeckGoRoutingListResponse`
- **THEN** the panel SHALL show binding count, default agent, DM scope, config hash state, binding order, tier, match dimensions, selected binding detail, and advisory conflict markers
- **AND** missing optional fields SHALL render as unavailable rather than fabricated values
- **AND** the queue/detail/simulator structure SHALL follow the refreshed v2 handoff unless doing so would hide contract-backed state

#### Scenario: Routing actions are invoked

- **WHEN** an operator validates, adds, removes, reorders, simulates, or patches DM scope
- **THEN** the panel SHALL call the existing API wrappers with normalized payloads and current config hash/base-hash values
- **AND** raw `/deck/routing` action strings SHALL remain inside API wrappers or tests, not repeated through view code
- **AND** reorder SHALL remain remove-plus-add unless a first-class backend reorder contract exists

#### Scenario: Gateway is not configured for routing-adjacent data

- **WHEN** a routing-adjacent request returns the Gateway-not-configured sentinel
- **THEN** the panel SHALL render the shared first-run empty state without exposing raw sentinel text as an error

### Requirement: Routing UI aligns with the settled frontend design system

The routing panel SHALL use the chat/agents design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Routing UI is rendered at desktop size

- **WHEN** the routing panel is rendered with contract-shaped mock data at desktop viewport size
- **THEN** the first viewport SHALL expose the routing queue, selected binding summary, simulator entry point, mutation/hash state, and routing-adjacent activity without overlapping text or nested decorative cards
- **AND** the visual hierarchy SHALL make current route result and mutation risk easier to scan than raw payload details
- **AND** v2 local molecules such as tier badges, match chips, hash chips, conflict markers, and mutation strips SHALL either map to existing atoms or remain module-local

#### Scenario: Routing UI is rendered at narrow size

- **WHEN** the routing panel is rendered at a narrow viewport
- **THEN** the layout SHALL collapse to a single column while preserving all core actions and preventing text overflow in buttons, rows, and metadata fields
