## Why

The current Agents panel is mostly a UI translation of the existing prototype and RPC wrappers, but Agents is one of Deck Go's highest-coupling control surfaces: it affects routing, skills, models, subagents, tools, sandboxing, workspace files, and channel delivery. We need a product-control pass that starts from OpenClaw's `openclaw.json` agent configuration truth, maps each mutable field to the right module ownership, and turns Agents into a safe enterprise control plane instead of a raw configuration form.

## What Changes

- Redesign the Agents module around the `openclaw.json` configuration domains it owns or references, especially `agents.list[]`, selected `agents.defaults` inheritance, `bindings`, model overrides, skills allowlists, subagent permissions, tools/sandbox policy, workspace files, and channel event streams.
- Add an explicit target product blueprint to the change: information architecture, field-to-UI decision matrix, cross-module ownership matrix, create/edit/delete flows, mock validation states, and real Gateway validation states.
- Add product-level protection for system/default agent semantics:
  - `main` is a protected system/fallback agent and cannot be deleted.
  - The configured default agent is shown distinctly from the `main` id and from `session.mainKey`.
  - High-impact fields such as workspace, model/runtime, skills mode, subagent permissions, tools/sandbox, and event streams require guarded edit affordances instead of casual inline edits.
- Split cross-module responsibilities explicitly:
  - Agents owns agent identity, lifecycle, workspace, per-agent runtime posture, and per-agent override summaries.
  - Skills, Models, Subagents, Routing, Tools/Approvals, Channels, and Sessions remain independent modules for deep management.
  - Agents may expose contextual previews, quick safe edits, and links/entry points where that is more ergonomic.
- Calibrate frontend UI and Deck-facing contracts to real OpenClaw Gateway capabilities, not to mock data or desired-only prototype fields.
- Extend Deck-facing DTOs and BFF behavior only where the Gateway already supports the underlying capability and the product shape is deterministic.
- Fix known deterministic drift where the Gateway/BFF create path supports a model seed but the current Deck-facing create contract and frontend create flow do not consistently expose it.
- Add strict verification requirements for:
  - mock visual/product states,
  - frontend interaction and write-protection tests,
  - contract and Go adapter checks,
  - bounded real Gateway E2E using isolated agent fixtures where safe.
- Record unsupported or deferred cross-module ambitions as handoff items instead of implying they are complete from the Agents page.

## Capabilities

### New Capabilities

- `deck-go-agents-product-control-plane`: Product-level Agents control-plane behavior, configuration ownership boundaries, protected/default agent semantics, guarded mutations, cross-module relationship handling, and verification evidence.

### Modified Capabilities

- None. Existing agents hifi, real verification, and contract completion specs remain valid baselines; this change adds a stricter product-control capability layered above them.

## Impact

- **Gateway truth**: `src/gateway/server-methods/agents.ts`, `src/gateway/server-methods/deck/agents*.ts`, `src/gateway/protocol/schema/agents-models-skills.ts`, `src/gateway/protocol/schema/deck.ts`, `src/agents/agent-scope-config.ts`, `src/config/types.agents.ts`, and related config schemas.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-ui.contract.json`, `deck-go/contracts/source/deck-mutations.contract.json`, `deck-go/contracts/source/deck-config-write-safety.contract.json`, generated TS/Go DTOs, and dynamic-surface records if deterministic DTO narrowing is added.
- **Go BFF/runtime**: agents routes and adapters in `deck-go/backend/internal/server/inventory.go`, `deck-go/backend/internal/runtime/openclaw/**`, and generated Gateway bindings.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, agents store/helpers, `deck-go/frontend-new/src/components/panels/agents/**`, i18n strings, design-system usage, and focused tests.
- **E2E and evidence**: `deck-go/test/e2e/agents-*.spec.ts`, real-stack helpers, handoff notes under `deck-go/frontend-handoff/modules/agents/`, and OpenSpec task evidence.
- **Dependencies**: no new runtime dependency is planned. Any table, search, graph, or editor dependency must be proposed separately if existing atoms/patterns are insufficient.
