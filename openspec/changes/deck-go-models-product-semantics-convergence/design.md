## Context

The previous Models control-plane work made provider/model CRUD typed and safer, but it also left two product gaps. First, some low-level OpenClaw implementation terms still appear as primary UI concepts. Operators should not need to decide between "merge" and "replace" as raw config primitives before understanding the product effect. They should see a catalog sync policy, an impact check, and explicit choices when an id collision or destructive operation occurs.

Second, model usage is not fully projected. OpenClaw supports model selection as a string or as an object with primary/fallbacks. The config truth is in `AgentModelConfig` and related `agents.defaults`, per-agent, and subagent fields, while `models.providers` only defines available model assets. Therefore Models must show usage/default/fallback truth, but Agents should own policy editing.

Current accepted follow-up `FU-001` already recorded "model default editing UI" as deferred. This change corrects and sharpens that decision: Models will not own all default/fallback editing; it will provide accurate read-only usage and owner links. Agents redesign will own model-policy editing.

## Goals / Non-Goals

**Goals:**

- Make Models UI product language match operator intent: manage model assets, inspect usage, check impact, and use advanced sync policy only when necessary.
- Repair reference projection so string and `{ primary, fallbacks }` model configs are both visible and protected by impact checks.
- Surface default/fallback references as first-class read-only usage facts in Models, including role labels and owner paths.
- Record a precise Agents redesign handoff for model strategy editing.
- Keep ordinary Models provider/model CRUD and advanced raw fallback working.
- Add verification that proves reference scanning, product copy, owner-boundary behavior, mock UI states, and real-safe route shapes.

**Non-Goals:**

- Building the full Agents model-policy editor in this change.
- Moving `agents.defaults.*` or per-agent model writes into the Models module as the primary editing surface.
- Adding upstream Gateway RPCs for model assignment or provider-specific writes.
- Adding new OpenClaw schema fields for rate limits, quota, pricing snapshots, or audit history.
- Removing raw config edit capabilities for advanced operators.

## Decisions

### Decision: Models owns model assets; Agents owns model strategy

Models SHALL own provider/model asset configuration and usage visibility. Agents SHALL own the runtime policy of which model an agent uses, including primary and fallback chain editing.

Rejected: Put all default/fallback editing directly in Models. That would make Models an accidental editor for `agents.*`, duplicate future Agents controls, and blur the config ownership boundary.

Rejected: Hide default/fallback details until Agents is rebuilt. Operators need to see why a provider/model cannot be safely deleted and which model references are active today.

### Decision: Product language wraps OpenClaw primitives

OpenClaw `models.mode` remains a real config field, but the UI should frame it as a catalog sync policy with consequence text and impact review. Delete flows should expose "Check impact" inside a delete confirmation flow, not a row-level "Preview delete" as if preview itself were the business action.

Rejected: Continue surfacing `merge` / `replace` and `preview delete` as primary button labels everywhere. Those are implementation steps, not user goals.

### Decision: Reference projection handles string and object model refs

The BFF reference scanner SHALL parse both:

- string refs such as `"cpa/gpt-5.4"`;
- object refs such as `{ "primary": "cpa/gpt-5.4", "fallbacks": ["openai/gpt-5.4-mini"] }`.

The scanner SHALL record whether a reference is a primary/default/fallback where that distinction is known. Impact previews and row badges can then show "default", "primary", "fallback", or "referenced" truthfully.

Rejected: Treat only `provider/model` strings as references. That misses supported OpenClaw fallback chains and can allow unsafe deletes.

### Decision: Handoff is part of completion

The change is not complete unless it updates the follow-up inbox with an Agents model-policy handoff that names exact source-truth fields and acceptance criteria for the later Agents redesign.

Rejected: Leave the handoff buried in chat or in vague follow-up prose. The next Agents proposal needs a precise input, not a rediscovery exercise.

## Risks / Trade-offs

- Reference scanning can still miss a model-bearing config path -> mitigate by deriving the list from OpenClaw config types and adding fixture tests for every scanned path.
- Product copy changes can regress visual density or confuse existing testers -> mitigate with mock screenshots/E2E states for ready, impact, conflict, and empty usage.
- Owner links may point to Agents features that are not fully rebuilt yet -> mitigate by showing read-only usage with a clearly labeled "edit in Agents" handoff/deferred state until Agents redesign lands.
- Full default/fallback editing is deferred -> mitigate by recording exact Agents acceptance criteria and keeping advanced raw editor available for operators who need immediate manual changes.
- Real E2E may be limited by local gateway state -> mitigate with bounded real route-shape smoke plus mandatory backend/frontend/mock verification.

## Migration Plan

1. Establish the fact baseline for OpenClaw model refs and current deck-go projection/UI behavior.
2. Repair contract/BFF projection for string/object/fallback references and default-role labeling.
3. Reword and restructure Models interactions so product actions are asset edit, check impact, delete, and catalog sync policy.
4. Update frontend tests/mock E2E for product semantics and usage projection.
5. Update handoff docs and create/update follow-up inbox entries for Agents model-policy editing.
6. Run OpenSpec strict validation, focused backend tests, focused frontend tests/build, mock E2E, and bounded real smoke where safe.

Rollback strategy: this change is largely additive and semantic. If reference projection changes fail, keep existing provider/model CRUD and raw editor available, disable new usage badges/owner links, and record the failing reference class as a follow-up rather than claiming complete impact protection.

## Open Questions

No product decision is required before implementation. During implementation, if OpenClaw code truth shows additional model-bearing fields outside the current scan list, they should be added to the projection when deterministic. If ownership is ambiguous, record the field in the Agents handoff or a module-specific follow-up instead of silently choosing an editor.
