## Why

Skills is an existing Control panel with typed Gateway coverage for `skills.*`, Deck-facing BFF wrappers, ClawHub actions, and agent skill matrix routes, but the UI still uses the legacy dense `deck-ui-skills` global shell. The module needs to join the contract-led high-fidelity rollout so operators can validate installed skills, missing requirements, configuration, installation options, ClawHub discovery, and per-agent assignment before the remaining Control/Integrations panels are rebuilt.

## What Changes

- Create a complete high-fidelity Skills handoff package under `deck-go/frontend-handoff/modules/skills/`.
- Redesign `deck-go/frontend-new/src/components/panels/skills/` into a compact skill operations workbench:
  - installed skill inventory with source, readiness, enablement, missing requirement, install option, and selected-skill evidence
  - selected skill detail with configuration editing, env JSON, primary env, install options, raw skill payload, and last mutation evidence
  - ClawHub bins/search/detail/install/update actions with selected hub package evidence and raw hub mutation output
  - agent skill matrix with per-agent mode, whitelist assignment toggles, config hash usage, navigation handoffs, and raw matrix mutation evidence
- Preserve the current frontend API wrapper behavior for `fetchSkills`, `updateSkill`, `installSkill`, `fetchSkillHubBins`, `searchSkillHub`, `fetchSkillHubDetail`, `installSkillHub`, `updateSkillHub`, `fetchAgentSkills`, and `updateAgentSkills`; browser code continues to call the Go BFF routes only.
- Confirm deterministic mock/local visual E2E data for `skills.status`, `skills.update`, `skills.install`, `skills.bins`, `skills.search`, `skills.detail`, ClawHub install/update, and `deck.agents.skills.*`; fix only deterministic mock drift needed for visual coverage.
- Move obsolete global `deck-ui-skills*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready inventory/detail, config save, install option, ClawHub search/detail/install or update, and agent skill matrix toggle where feasible.
- Update cross-module readiness evidence with Skills-specific findings and skill/config/catalog/matrix molecule candidates.

## Capabilities

### New Capabilities

- `frontend-skills-hifi-redesign`: Covers the Skills handoff package, production UI rewrite, mock/local visual verification, and local contract/drift findings for skill inventory, configuration, installation, ClawHub, and agent skill assignment workflows.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Skills implementation evidence and classifies whether skill inventory rows, requirement evidence, config editors, install-option rows, ClawHub catalog rows, agent skill matrix cells, and raw action details remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/skills/`
- `deck-go/frontend-new/src/components/panels/skills/`
- `deck-go/frontend-new/src/theme.css` Skills global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` or E2E setup only if deterministic mock visual gaps are found
- `deck-go/test/e2e/` focused Skills mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-skills-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
