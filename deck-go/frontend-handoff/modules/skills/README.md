# Skills

**Status**: implemented-awaiting-archive
**Design completed**: 2026-05-03
**Designer**: Codex single-agent replacement workflow
**Depends on atoms**: Button, Input, Select, Toggle/Checkbox, Badge/Pill, Card, Code/Json detail, Status, Spinner
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

Skills is the Automate workspace for installed skill readiness, missing setup evidence, local skill config, install options, ClawHub discovery/actions, and per-agent skill assignment. It lets an operator answer which skills are available, what setup is missing, how a selected skill is configured, which marketplace package is being installed, and how each agent's whitelist uses the current Gateway config hash.

This package is a high-fidelity handoff for `deck-go/frontend-new/src/components/panels/skills/`. It is based on the current deck-go contract chain and production behavior. Code and contracts remain the source of truth; this prototype is an implementation guide.

## Contract truth

- Frontend wrappers: `fetchSkills`, `updateSkill`, `installSkill`, `fetchSkillHubBins`, `searchSkillHub`, `fetchSkillHubDetail`, `installSkillHub`, `updateSkillHub`, `fetchAgentSkills`, and `updateAgentSkills`.
- BFF endpoints: `GET /api/skills`, `PATCH /api/skills/{skillKey}`, `POST /api/skills/install`, `POST /api/skills/hub`, and `/api/agents` actions for `skills.get` / `skills.set`.
- Gateway methods: `skills.status`, `skills.update`, `skills.install`, `skills.bins`, `skills.search`, `skills.detail`, `deck.agents.skills.get`, and `deck.agents.skills.set`.
- DTO authority: `DeckGoSkillEntry`, `DeckGoSkillsResponse`, `DeckGoSkillHub*`, `DeckGoAgentSkillsResponse`, and generated Gateway protocol types.
- Browser code must continue to call the Go BFF wrappers only; it must not call Gateway, ClawHub, or the filesystem directly.

## How to implement

1. Open `prototype.html` and inspect the skill operations workbench layout, inventory, selected skill detail, ClawHub rail, matrix surface, and last-action details.
2. Read `components.md` for module-local component structure and data boundaries.
3. Read `states.md` for loading, ready, empty, error, selected-skill, hub, config, install, and matrix states.
4. Read `interactions.md` for selection, filtering, config save, install, hub search/detail/install/update, matrix toggles, focus, and overflow behavior.
5. Read `api-usage.md` and preserve the current BFF path and mutation envelopes.
6. Read `implementation-notes.md` for production migration notes and mock visual follow-ups.

## Open questions for implementation

- Mock visual E2E should add deterministic `skills.*` and `deck.agents.skills.*` mock Gateway handlers if they are still absent.
- Real ClawHub network access, install safety, binary dependency verification, credential persistence, and marketplace trust are outside mock visual coverage.
- A full skill authoring IDE, dependency solver, or credential vault is out of scope for this pass.
