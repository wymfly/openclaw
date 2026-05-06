## ADDED Requirements

### Requirement: Agents live events preserve explicit list state

The agents frontend store SHALL preserve an explicit no-selection state when
live Gateway events update agent metrics.

#### Scenario: Operator returns to the agents list while live events continue

- **WHEN** the agents store has loaded one or more agents
- **AND** `selectedAgentId` is `null`
- **AND** a live server event updates an agent metric or status
- **THEN** `selectedAgentId` SHALL remain `null`
- **AND** the Agents panel SHALL remain in list view.

### Requirement: Agents real E2E uses isolated run-scoped fixture data

Agents real Gateway tests SHALL create representative test data in the isolated
OpenClaw state when validating product flows.

#### Scenario: Agents real fixture is created

- **WHEN** the agents real E2E suite starts against the isolated real stack
- **THEN** it SHALL create an agent whose id or name includes the current real
  E2E run id
- **AND** it SHALL clean up only that run-scoped agent
- **AND** it SHALL refuse cleanup of any target that is not run-scoped.

### Requirement: Agents real E2E covers shell navigation, variants, and child sections

Agents real Gateway UI evidence SHALL cover the strengthened product-level real
E2E rubric.

#### Scenario: Agents real UI is validated

- **WHEN** the agents real Gateway Playwright spec runs
- **THEN** it SHALL navigate from another Deck shell panel to Agents by clicking
  the Agents navigation item
- **AND** it SHALL validate at least one dark English render and one light
  Chinese render
- **AND** it SHALL open a real run-scoped agent detail page
- **AND** it SHALL interact with the Overview, Skills, Subagents, Tool Policy,
  System Prompt, Files, and Event Streams sections
- **AND** returning to the list SHALL remain stable while live events are
  connected
- **AND** unexpected console, page, or BFF API errors SHALL fail the test.
