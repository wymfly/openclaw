## ADDED Requirements

### Requirement: Webhooks handoff package defines the visual contract

The webhooks module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/webhooks/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing webhook wrappers, `/api/webhooks*` BFF routes, and `DeckGoWebhook*` DTOs as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the webhooks handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document webhook inventory, selected receiver detail, event subscriptions, create/edit form, delivery history, test delivery result, last-action evidence, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain real receiver delivery behavior SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Webhooks production panel follows contract-backed workflows

The production webhooks panel SHALL render and operate from contract-backed Deck webhook data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Webhook inventory is loaded

- **WHEN** `fetchWebhooks` and `fetchWebhookDeliveries` resolve with contract-shaped data
- **THEN** the panel SHALL show webhook readiness, configured count, enabled count, delivery count, selected webhook identity, selected receiver URL, event subscription evidence, failure count, last status, last fired evidence, and delivery history evidence
- **AND** missing optional fields such as secret, last fired time, last status, response body, error, duration, attempt, or retry metadata SHALL render as unavailable evidence rather than fabricated values

#### Scenario: Webhook actions are used

- **WHEN** an operator creates, edits, tests, refreshes, loads selected, saves selected, or deletes a webhook
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** delete SHALL remain guarded by confirmation
- **AND** successful action results SHALL remain inspectable as raw evidence without replacing the loaded webhook contract payload

#### Scenario: Delivery history is inspected

- **WHEN** an operator inspects delivery history for a selected webhook
- **THEN** delivery rows SHALL render from `DeckGoWebhookDelivery[]`
- **AND** success/failure, status code, duration, attempt, retry, response/error detail, and created time SHALL be displayed when present
- **AND** changing selected webhook SHALL load deliveries for the selected webhook without mutating the webhook inventory

### Requirement: Webhooks UI aligns with the settled frontend design system

The webhooks panel SHALL use the current chat/agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads/activity/api-explorer/cron design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Webhooks UI is rendered

- **WHEN** the webhooks panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose receiver inventory, selected receiver evidence, delivery history, event subscriptions, form/test/delete actions, and raw evidence access without overlapping text or nested decorative cards
- **AND** long webhook names, receiver URLs, event names, response bodies, errors, and payload text SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Webhooks mock visual verification is available

The webhooks rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped webhook data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the webhooks mock visual E2E is executed
- **THEN** it SHALL load webhook inventory and delivery history through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as delivery-history inspection, event selection, edit form, test delivery result, selected webhook switching, or delete confirmation
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM or full external receiver delivery assurance
