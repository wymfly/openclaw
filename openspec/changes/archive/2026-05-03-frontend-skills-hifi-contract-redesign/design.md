## Context

`frontend-new` already contains a functional `SkillsPanel` under the `skills` panel id. It calls Deck-facing wrappers for installed skill inventory, skill enable/config/install actions, ClawHub search/detail/install/update actions, and the agent skill matrix:

- `fetchSkills(agentId?)` -> `GET /api/skills`
- `updateSkill(skillKey, patch)` -> `PATCH /api/skills/{skillKey}`
- `installSkill(name, installId)` -> `POST /api/skills/install`
- `fetchSkillHubBins`, `searchSkillHub`, `fetchSkillHubDetail`, `installSkillHub`, and `updateSkillHub` -> `POST /api/skills/hub`
- `fetchAgentSkills` and `updateAgentSkills` -> `/api/agents` action wrappers for `deck.agents.skills.get` / `deck.agents.skills.set`

Gateway generated coverage exists for `skills.status`, `skills.update`, `skills.install`, `skills.search`, `skills.detail`, `skills.bins`, `deck.agents.skills.get`, and `deck.agents.skills.set`. The Go BFF forwards through typed Gateway query helpers. The current gap is visual and verification convergence: the panel still uses global `deck-ui-skills*` styling in `theme.css`, packs multiple responsibilities into generic cards, and the bundled mock Gateway does not yet provide deterministic skill/hub/matrix payloads for visual E2E.

## Goals / Non-Goals

**Goals:**

- Produce a complete Skills handoff package.
- Rewrite Skills into a high-fidelity skill operations workbench aligned with the current design-system posture.
- Preserve load/error handling, selection fallback, enable/disable, config save, install option, ClawHub search/detail/install/update, agent matrix refresh/toggle, and navigation handoff behavior.
- Add deterministic mock Gateway fixtures for skill inventory, hub data, and agent matrix calls only where required by visual E2E.
- Record Skills-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, or Deck-facing DTO contract unless implementation proves a deterministic mismatch.
- No browser-side direct Gateway call.
- No ClawHub marketplace redesign, skill authoring IDE, dependency solver, credential vault, or real install safety assurance.
- No new dependencies, table libraries, schema editors, date libraries, or chart libraries.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Skills as a skill operations workbench, not a skill authoring environment.**
   The first viewport should expose installed readiness, missing requirements, selected skill evidence, safe config actions, ClawHub discovery, and agent assignment. Editing arbitrary skill package metadata, authoring new skills, or resolving install dependencies is out of scope.

2. **Preserve the BFF/Gateway contract boundary.**
   The frontend already uses wrappers that call Go BFF endpoints. The rewrite should keep those wrappers and avoid any browser-to-Gateway RPC or direct filesystem/ClawHub access.

3. **Use module-local catalog, requirement, config, install, and matrix molecules.**
   Skills repeats prior workbench patterns but adds catalog/matrix/config semantics. Promotion to shared patterns waits for a separate design-system proposal with enough API evidence.

4. **Make mock Gateway fixture changes deterministic and contract-shaped.**
   Visual E2E should exercise the real frontend against bundled mock Gateway methods. Fixture additions should cover only `skills.*` and `deck.agents.skills.*` methods needed by the current panel, returning payloads shaped like generated Gateway results and existing Deck wrappers expect.

5. **Keep raw evidence visible but secondary.**
   Selected skill payload, hub action results, and matrix mutation results remain inspectable through raw details. The primary UI should communicate readiness, missing setup, selected configuration, and assignment decisions without requiring JSON inspection.

## Risks / Trade-offs

- **Risk: Config editing with env JSON regresses mutation envelopes.** -> Keep focused unit coverage for config save and E2E coverage for save-result visibility; do not change wrapper signatures.
- **Risk: Mock ClawHub install/search creates false confidence about real marketplace behavior.** -> Label E2E as mock/local visual coverage; document real install/network safety as follow-up.
- **Risk: Agent skill matrix becomes too wide.** -> Use stable constrained table/rail regions, wrapping labels and limiting first-viewport content; preserve keyboard/focus access to toggles.
- **Risk: Global CSS cleanup affects other modules.** -> Remove only `deck-ui-skills*` styling from `theme.css`; keep new styling in `skills-panel.css`.
- **Risk: Requirement normalization drops upstream fields.** -> Preserve raw skill payload evidence and avoid fabricating unavailable optional fields.
