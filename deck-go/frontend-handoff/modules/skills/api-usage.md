# Skills API Usage

Code and generated contracts are the authority. This document records the frontend-facing contract used by the high-fidelity Skills redesign.

## Installed inventory

### `fetchSkills(agentId?)`

- Frontend wrapper: `deck-go/frontend-new/src/api.ts`
- Browser route: `GET /api/skills?agentId=<id>`
- BFF route: `GET /skills`
- Runtime adapter: `ListSkills`
- Gateway method: `skills.status`
- Result shape: `DeckGoSkillsResponse` / `SkillsStatusResult`

The UI consumes `skills[]`, `managedSkillsDir`, and `workspaceDir` when present. Individual raw skills may include:

- `skillKey` or `key`
- `name`, `description`, `emoji`, `homepage`
- `source`
- `disabled`, `eligible`, `always`, `bundled`, `blockedByAllowlist`
- `primaryEnv`
- `missing` / `requirements`
- `config`
- `install`

Missing optional fields render as unavailable evidence.

## Skill mutations

### `updateSkill(skillKey, patch)`

- Browser route: `PATCH /api/skills/{skillKey}`
- BFF route: `PATCH /skills/{skillKey}`
- Gateway method: `skills.update`
- Mutation envelope: `{ skillKey, enabled?, apiKey?, env? }`
- Result shape: `DeckGoSkillUpdateResponse` / `SkillsUpdateResult`

The browser wrapper owns `skillKey` in the route and the backend injects it into the Gateway body. The UI must not change that envelope.

### `installSkill(name, installId)`

- Browser route: `POST /api/skills/install`
- BFF route: `POST /skills/install`
- Gateway method: `skills.install`
- Mutation envelope: `{ name, installId }`
- Result shape: `SkillsInstallResult`

Install option actions use the selected skill's `name` and selected install option `id`.

## ClawHub actions

All ClawHub browser actions use `POST /api/skills/hub`.

| Action  | Wrapper               | Gateway method   | Body                                    |
| ------- | --------------------- | ---------------- | --------------------------------------- |
| bins    | `fetchSkillHubBins`   | `skills.bins`    | `{ action: "bins" }`                    |
| search  | `searchSkillHub`      | `skills.search`  | `{ action: "search", query, limit }`    |
| detail  | `fetchSkillHubDetail` | `skills.detail`  | `{ action: "detail", slug }`            |
| install | `installSkillHub`     | `skills.install` | `{ action: "install", slug, version? }` |
| update  | `updateSkillHub`      | `skills.update`  | `{ action: "update", slug? }`           |

The UI treats these as Gateway-backed marketplace actions but labels mock visual evidence as mock-only. Real network, trust, binary dependency, and credential behavior are not proven by visual E2E.

## Agent skill matrix

### `fetchAgentSkills(agentId)`

- Browser route: `POST /api/agents`
- BFF action: `skills.get`
- Gateway method: `deck.agents.skills.get`
- Body: `{ action: "skills.get", agentId }`
- Result shape: `DeckGoAgentSkillsResponse`

### `updateAgentSkills(agentId, params)`

- Browser route: `POST /api/agents`
- BFF action: `skills.set`
- Gateway method: `deck.agents.skills.set`
- Body: `{ action: "skills.set", agentId, mode, skills, baseHash }`
- Result shape: `DeckGoAgentSkillsSetResponse`

Agent whitelist toggles must pass the current `configHash` as `baseHash`. Agents in `mode: "all"` render as read-only all-skills coverage.
