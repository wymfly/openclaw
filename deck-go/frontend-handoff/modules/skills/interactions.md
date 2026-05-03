# Skills Interactions

## Inventory

- Search filters by skill name, key, and description.
- Status filter supports all, ready, needs setup, and disabled.
- Selecting a skill updates the detail surface, config drafts, install options, and raw payload.
- Refresh reloads installed skill inventory and preserves the selected key when it still exists.
- Enable/disable calls `updateSkill(skill.key, { enabled })`.

## Configuration

- API key input updates the local draft only.
- Environment JSON textarea updates the local draft only.
- Save parses the JSON object, trims keys, stringifies values, and calls `updateSkill(skill.key, { apiKey, env })`.
- Invalid JSON should keep focus in the editor and surface an error.

## Install options

- Each install option is rendered with label, id, and required bins.
- Install calls `installSkill(selectedSkill.name, option.id)`.
- Mutation result remains visible as raw evidence.

## ClawHub

- Enter in the search box runs `searchSkillHub(query, 20)`.
- Clicking a bin chip copies it into the query and runs search.
- Clicking a result calls `fetchSkillHubDetail(slug)`.
- Installing from detail calls `installSkillHub(slug, latestVersion?.version)`.
- Update all calls `updateSkillHub()`.
- Hub action result remains separate from installed inventory until refresh resolves.

## Agent matrix

- Matrix data loads from `fetchAgentsList()` plus `fetchAgentSkills(agent.id)` for each agent.
- Agent headers navigate to the Agents panel skills view.
- `mode: "all"` cells are read-only.
- `mode: "whitelist"` cells toggle inclusion and call `updateAgentSkills(agent.id, { mode, skills, baseHash: config.configHash })`.
- Toggle results update local `skills`, `available[].assigned`, and `configHash`.

## Keyboard, focus, and overflow

- All interactive rows are buttons or controls with visible focus.
- Buttons should have stable min heights and no layout shift when action text changes to loading text.
- Matrix table can scroll inside its surface on narrow screens; the page itself should not introduce horizontal overflow.
- Long env keys, slugs, config hashes, paths, and JSON should wrap or truncate inside their surfaces.
