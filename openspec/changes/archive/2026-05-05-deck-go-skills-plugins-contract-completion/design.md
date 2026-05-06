## Context

Skills and Plugins sit on Gateway-backed inventory and extension-runtime
contracts. Plugins are currently read-only in Deck Go and already avoid
accidental dynamic-surface findings. Skills is broader: read paths are verified,
but the Deck-facing inventory response still exposes `skills` as
`Record<string, unknown>[]`, Skill Hub mutation responses use a generic
record envelope, and visible write facades are not action-level
mutation-evidence known.

Current source truth:

- `skills.status`, `skills.bins`, `skills.search`, `skills.detail`,
  `skills.install`, `skills.update`, `deck.agents.skills.get`, and
  `deck.agents.skills.set` are Gateway-described methods with generated
  TS/Go protocol types.
- `/api/skills`, `/api/skills/{skillKey}`, `/api/skills/install`, and
  `/api/skills/hub` are Deck BFF routes over those Gateway methods.
- `/api/deck/plugins` calls `deck.plugins.list` and remains read-only.
- Agent skill matrix save is already mutation-evidence known as
  `agents.skills.save`; this child proposal covers installed skill and Skill
  Hub writes.

## Goals / Non-Goals

**Goals:**

- Normalize Skills inventory at the Deck BFF boundary so
  `DeckGoSkillsResponse.skills` can be typed as `DeckGoSkillEntry[]`.
- Keep frontend Skills projection tolerant of older/raw Gateway rows while the
  BFF normalization settles.
- Add a `DeckGoSkillInstallResponse` DTO and narrow Skill Hub mutation response
  fields to current Gateway result shapes.
- Add mutation evidence for Skills update/install and Skill Hub install/update
  actions.
- Route Skills write facades through shared mutation evidence helpers.
- Confirm Plugins has no accidental dynamic contract leaves and close the
  follow-up with explicit unsupported plugin lifecycle/trust leaves.

**Non-Goals:**

- Do not run real skill install/update against the operator workspace.
- Do not add plugin lifecycle mutations, marketplace, manifest, audit, trust, or
  package signature routes.
- Do not add per-skill config schemas; skill-specific config remains an
  intentional dynamic fragment.
- Do not change Gateway methods or add new upstream OpenClaw contracts.

## Decisions

### Decision: Normalize Skills inventory in deck-go BFF

The Gateway `skills.status` result is richer and Gateway-shaped; Deck UI needs a
stable product summary. The BFF should map Gateway rows to `DeckGoSkillEntry`
while preserving current panel behavior and empty-valid handling.

Alternative rejected: keep `Record<string, unknown>[]` and rely on frontend
normalization forever. That leaves the Deck-facing contract too weak for future
frontend generation and keeps a known dynamic-surface TODO open.

### Decision: Keep per-skill config dynamic but narrow mutation envelopes

Skill config is genuinely skill-specific. However, install/update mutation
envelopes have known Gateway result fields (`ok`, `message`, command output,
`skillKey`, and ClawHub result metadata), so those should be named instead of a
catch-all record.

Alternative rejected: fully type every `config` object. That would invent
per-skill schemas Deck Go does not own and would overfit current examples.

### Decision: Treat Skills writes as action-known but skipped/deferred for real fixtures

Skills update, local install, ClawHub install, and ClawHub update can mutate
workspace files or operator config. They need mutation evidence for UI/product
truth, but automated real E2E should stay skipped-safe until disposable
workspace/config fixtures are proven.

Alternative rejected: leave all Skills writes only in the mixed deferred class.
That hides visible product actions from the mutation contract and weakens the
frontend contract chain.

### Decision: Plugins remains read-only and product-limited

Plugins inventory is verified as a read-only control surface. Missing manifest,
audit, lifecycle, marketplace, and trust features are product gaps, not current
contract drift.

## Risks / Trade-offs

- **Risk:** BFF normalization drops raw Gateway fields some future UI might want.
  **Mitigation:** Only the Deck product summary is contractual; raw/plugin
  specific details require explicit DTO additions.
- **Risk:** Skill Hub mutation result fields may evolve upstream.
  **Mitigation:** Keep known optional fields and record unsupported/new shapes as
  dynamic-surface follow-ups rather than broadening the product DTO silently.
- **Risk:** Matrix rows marked verified may be confused with real write safety.
  **Mitigation:** Matrix gaps and mutation evidence must keep write fixtures
  skipped-safe/deferred until disposable state exists.

## Migration Plan

1. Update Deck API contracts for normalized Skills inventory and Skills
   install/hub mutation responses.
2. Normalize `/api/skills` responses in the Go BFF.
3. Add Skills mutation evidence and regenerate generated artifacts/docs.
4. Route Skills mutation facades through mutation evidence helpers and update
   focused tests.
5. Update Skills/Plugins notes, matrix rows, generated matrix Markdown, and head
   verification evidence.
6. Run focused contract, backend, frontend, build, OpenSpec, and diff checks;
   then archive this child proposal.
