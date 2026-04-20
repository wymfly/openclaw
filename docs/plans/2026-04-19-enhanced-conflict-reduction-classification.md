# Enhanced Conflict Reduction Classification

## Purpose

This document classifies the `enhanced` branch core delta after upstream baseline `v2026.4.15` into three buckets:

1. `Can upstream`
2. `Can isolate behind a fork seam`
3. `Must remain a long lived fork patch`

The goal is not aesthetic cleanliness. The goal is to identify which changes must leave upstream hot paths if the project wants rebase conflict pressure to approach zero.

## Baseline

- Comparison baseline: `0c0463b2b7`
- Baseline tag: `v2026.4.15`
- Audit branch: `enhanced`
- Audit date: `2026-04-19`

## Decision Rule

A change is classified by the cheapest credible path to lower future rebase conflicts.

- `Can upstream`
  The behavior is generic enough that the best long term place is upstream OpenClaw.
- `Can isolate behind a fork seam`
  The behavior may remain fork specific, but it should move out of upstream hot files and into a narrow adapter, sidecar, generated layer, or Deck owned compatibility surface.
- `Must remain a long lived fork patch`
  The behavior is fork specific and cannot realistically be moved out without changing product scope or deleting capability.

## Hard Constraint

If the target is literally zero recurring merge conflicts against upstream core, then every change currently living in shared upstream owned files must end up in one of only two states:

- accepted upstream
- removed from core and relocated behind a seam the fork owns alone

Anything else remains a future conflict source.

## Bucket 1: Can Upstream

These are the best candidates to reduce conflicts by making the divergence disappear instead of hiding it.

### Generic Gateway registry and introspection primitives

Files:

- `src/gateway/method-registry.ts`
- `src/gateway/server-methods/describe.ts`
- `src/gateway/method-registry-data.test.ts`
- `src/gateway/method-registry.test.ts`
- `src/gateway/server-methods/describe.test.ts`

Why:

- `MethodRegistry` and `gateway.describe` are generic infrastructure, not inherently Deck specific.
- They solve a real problem for any external control plane, SDK generator, or admin UI.

What would need to change before upstreaming:

- remove Deck centric framing from comments, scripts, and follow on assumptions
- define a stable upstream position on schema versioning and typed versus untyped methods

Rebase payoff:

- high

### Generic method metadata and result schema completion

Files:

- `src/gateway/server-methods/chat-method-defs.ts`
- `src/gateway/server-methods/config-method-defs.ts`
- `src/gateway/server-methods/control-plane-method-defs.ts`
- `src/gateway/server-methods/device-method-defs.ts`
- `src/gateway/server-methods/node-method-defs.ts`
- `src/gateway/server-methods/sessions-method-defs.ts`
- `src/gateway/server-methods/skills-method-defs.ts`
- `src/gateway/server-methods/talk-method-defs.ts`
- `src/gateway/server-methods/usage-method-defs.ts`
- `src/gateway/server-methods/wizard-method-defs.ts`
- `src/gateway/protocol/schema/agent.ts`
- `src/gateway/protocol/schema/agents-models-skills.ts`
- `src/gateway/protocol/schema/channels.ts`
- `src/gateway/protocol/schema/config.ts`
- `src/gateway/protocol/schema/control-plane-results.ts`
- `src/gateway/protocol/schema/cron.ts`
- `src/gateway/protocol/schema/devices.ts`
- `src/gateway/protocol/schema/exec-approvals.ts`
- `src/gateway/protocol/schema/logs-chat.ts`
- `src/gateway/protocol/schema/nodes.ts`
- `src/gateway/protocol/schema/sessions.ts`
- `src/gateway/protocol/schema/transcript.ts`
- `src/gateway/protocol/schema/usage-result-schemas.ts`
- `src/gateway/protocol/schema/wizard-spec.ts`
- `src/gateway/protocol/schema/wizard.ts`

Why:

- Explicit result schemas and method metadata are broadly useful.
- This is the cleanest way to stop re solving the same typing problem after every upstream rebase.

What would need to change before upstreaming:

- prioritize non Deck methods first
- avoid requiring upstream to adopt the entire Deck codegen workflow in one step

Rebase payoff:

- very high

### Bundled plugin and channel compatibility fixes with generic value

Files:

- `src/channels/plugins/bundled.ts`
- `src/channels/plugins/catalog.ts`
- `src/channels/plugins/catalog.test.ts`
- `scripts/copy-bundled-plugin-metadata.mjs`
- `scripts/stage-bundled-plugin-runtime-deps.mjs`
- `scripts/stage-bundled-plugin-runtime.mjs`

Why:

- nested `node_modules` relocation
- legacy bundled channel export compatibility
- better bundled metadata staging

These are not Deck product features. They are packaging and compatibility fixes.

Rebase payoff:

- medium

### Windows service reliability fixes

Files:

- `src/daemon/schtasks.ts`
- `src/daemon/schtasks.test.ts`
- `src/daemon/service-audit.ts`

Why:

- restart loop parsing and `schtasks` resilience are generic Windows operational improvements.

Rebase payoff:

- medium

### Generic chat and media robustness that should not stay fork only

Files:

- `src/media-understanding/apply.ts`
- `src/media-understanding/types.ts`
- `src/media/mime.ts`
- `src/gateway/server-methods/nodes.handlers.invoke-result.ts`

Why:

- text heuristic recovery from binary classified files
- better non image attachment support
- safer or richer result handling

Rebase payoff:

- medium

## Bucket 2: Can Isolate Behind A Fork Seam

These changes may remain fork specific, but they should leave upstream hot files if the goal is drastic conflict reduction.

### Protocol code generation and Deck coverage tooling

Files:

- `scripts/protocol-gen-ts.ts`
- `scripts/protocol-coverage-check.ts`
- `scripts/lib/protocol-coverage-report.ts`
- `scripts/deck-gap-report.ts`
- `test/scripts/protocol-coverage-check.test.ts`

Target seam:

- a Deck owned toolchain package or sidecar tooling directory that reads `gateway.describe`

Why:

- The codegen need is real, but the generator itself does not belong in upstream runtime critical paths.
- Once `gateway.describe` exists, Deck can generate from the live protocol without keeping generator logic entangled with core.

Rebase payoff:

- high

### Deck facing plugin metadata

Files:

- `src/plugin-sdk/wizard-spec.ts`
- `src/plugins/manifest.ts`
- `src/plugins/manifest-registry.ts`
- `src/plugins/registry-types.ts`
- `src/plugins/registry.ts`
- `src/plugins/status.test.ts`
- `src/channels/plugins/types.plugin.ts`

Specific fork features here:

- `deck.setupWizardSpec`
- Deck locales in manifest snapshots
- Deck action capabilities in manifest snapshots

Target seam:

- separate Deck manifest companion file
- Deck owned metadata sidecar
- generated Deck registry artifact produced from plugin sources during build

Why:

- The metadata exists for Deck discovery and setup UX, not for upstream core runtime semantics.
- Keeping it in generic plugin manifest types broadens the overlap with upstream plugin loader work.

Rebase payoff:

- high

### Model and auth observability layer

Files:

- `src/agents/auth-diagnostics.ts`
- `src/agents/auth-diagnostics.test.ts`
- `src/agents/provider-defaults.ts`
- `src/gateway/server-methods/model-provider-provenance.ts`
- `src/gateway/server-methods/models-catalog-providers.ts`
- `src/gateway/server-methods/models.ts`
- `src/gateway/server-methods/models.test.ts`
- `src/gateway/server-methods/deck-auth.ts`
- `src/gateway/server-methods/deck-auth.test.ts`
- `src/commands/models/list.probe.ts`

Target seam:

- Deck server side adapter that composes upstream data
- local sidecar service that reads config, auth profiles, env, and runtime catalog
- Deck only RPC namespace implemented outside upstream hot files if pluginized host hooks become possible

Why:

- This layer is mostly a management UI projection over upstream state.
- It is useful, but it is not fundamental core behavior.

Rebase payoff:

- high

### Event stream filtering

Files:

- `src/config/types.agent-defaults.ts`
- `src/config/types.agents.ts`
- `src/config/zod-schema.agent-defaults.ts`
- `src/config/zod-schema.agent-runtime.ts`
- `src/gateway/channel-event-filter.ts`
- `src/gateway/channel-event-filter.test.ts`
- `src/gateway/server-node-subscriptions.ts`

Target seam:

- Deck side filtering of agent streams
- dedicated fork side subscriber gateway
- optional proxy layer between Gateway and Deck

Why:

- This feature exists to control Deck and subscriber noise.
- If the project is willing to accept higher raw event volume, the filtering does not need to live in upstream core.

Rebase payoff:

- medium to high

### Transcript normalization and UI oriented shaping

Files:

- `src/gateway/transcript-canonical.ts`
- `src/gateway/server-chat.ts`
- `src/gateway/server-methods/chat.ts`
- `src/gateway/server-chat.agent-events.test.ts`
- `src/gateway/server-methods/chat.transcript-contract.test.ts`
- `src/gateway/session-message-events.test.ts`
- `src/gateway/session-utils.types.ts`
- `src/gateway/protocol/schema/transcript.ts`

Target seam:

- Deck side compatibility adapter that canonicalizes transcript payloads for rendering
- read time normalization instead of write time normalization
- sidecar transcript projection store

Why:

- A large part of this change exists so Deck can render whitebox blocks, tool payloads, and mixed legacy transcript content cleanly.
- Upstream chat and transcript code is high churn. This is exactly the wrong place to keep Deck specific representation fixes.

Rebase payoff:

- very high

### Local development and verification support for Deck integration

Files:

- `scripts/dev/deck-dev.sh`
- `test/dashboard-test-gate.test.ts`
- `scripts/check-no-extension-src-imports.ts`
- `scripts/test-runner-manifest.d.mts`

Target seam:

- keep under fork owned scripts and CI only

Why:

- Useful, but not upstream runtime behavior.

Rebase payoff:

- low to medium

## Bucket 3: Must Remain A Long Lived Fork Patch

These changes are fork owned product surface. They either stay or the feature disappears.

### Deck specific Gateway RPC namespace

Files:

- `src/gateway/protocol/schema/deck.ts`
- `src/gateway/server-methods/deck/agents-preview.ts`
- `src/gateway/server-methods/deck/agents-preview.test.ts`
- `src/gateway/server-methods/deck/agents.ts`
- `src/gateway/server-methods/deck/agents.test.ts`
- `src/gateway/server-methods/deck/commands.ts`
- `src/gateway/server-methods/deck/commands.test.ts`
- `src/gateway/server-methods/deck/identity.ts`
- `src/gateway/server-methods/deck/identity.test.ts`
- `src/gateway/server-methods/deck/index.ts`
- `src/gateway/server-methods/deck/plugins.ts`
- `src/gateway/server-methods/deck/plugins.test.ts`
- `src/gateway/server-methods/deck/routing.ts`
- `src/gateway/server-methods/deck/routing.test.ts`
- `src/gateway/server-methods/deck/subagents-steer.ts`
- `src/gateway/server-methods/deck/subagents-steer.test.ts`
- `src/gateway/server-methods/deck/subagents.ts`
- `src/gateway/server-methods/deck/subagents.test.ts`
- `src/gateway/server-methods/deck/threads.ts`
- `src/gateway/server-methods/deck/utils.ts`
- `src/gateway/server-methods/deck/utils.test.ts`

Why:

- This is direct product surface for the fork's Deck experience.
- Upstream is unlikely to accept a large `deck.*` namespace.

Conflict implication:

- If this code remains inside core Gateway, rebase conflicts do not go to zero.
- The only way to push conflict pressure close to zero is to move this namespace out of upstream hot files and host it behind a fork only seam.

### Deck adjacent auth RPCs if not upstreamed

Files:

- `src/gateway/server-methods/deck-auth.ts`
- `src/gateway/server-methods/deck-auth.test.ts`

Why:

- These are still product surface for the Deck management UI.
- They only leave this bucket if re implemented outside core or accepted upstream in generic form.

### Fork only protocol adaptation for Deck if upstream refuses generic metadata

Files:

- `src/gateway/server-methods-list.ts`
- `src/gateway/server-methods.ts`
- `src/gateway/method-scopes.ts`
- `src/gateway/protocol/index.ts`
- `src/gateway/protocol/schema.ts`
- `src/gateway/protocol/schema/protocol-schemas.ts`
- `src/gateway/event-defs.ts`
- `src/gateway/server.impl.ts`
- `src/gateway/server/ws-connection/message-handler.ts`

Why:

- These files are only in this bucket to the extent that they continue carrying fork only registrations, Deck only methods, or Deck only schema wiring.
- If the Deck specific registrations move out, most of this bucket can shrink dramatically.

## File Family Summary By Best Action

### Upstream first

- generic Gateway registry and describe infrastructure
- generic result schema completion
- generic bundled runtime compatibility fixes
- Windows service reliability fixes
- generic media and attachment robustness

### Extract behind seam first

- protocol codegen and coverage tooling
- Deck metadata in plugin manifest and registry
- model and auth observability projection
- event stream filtering
- transcript normalization for Deck rendering

### Keep only if the fork accepts permanent divergence

- `deck.*` Gateway methods
- Deck auth RPCs in current form
- any Deck only registration that still lives in upstream core registration files

## Practical Interpretation

If the project wants conflict reduction without deleting Deck capabilities, the fastest win is not to upstream everything.

The fastest win is:

1. upstream the genuinely generic infrastructure
2. move Deck specific projections and metadata shaping out of upstream hot files
3. leave only the irreducibly fork specific RPC surface as the remaining divergence

That does not get conflicts to literal zero, but it sharply narrows the problem.

To get all the way to zero recurring core conflicts, even the `deck.*` surface would need to stop modifying shared core files. That means a host seam, sidecar Gateway extension layer, or a stronger Deck side compromise.

## Recommended Order

1. Upstream or stabilize `MethodRegistry`, `gateway.describe`, and non Deck method metadata.
2. Move protocol codegen and coverage analysis fully out of core runtime ownership.
3. Move Deck manifest metadata into a fork owned sidecar or generated registry artifact.
4. Decide whether event filtering and transcript canonicalization are worth keeping in core, or whether Deck can absorb the complexity.
5. Reduce the Deck only Gateway surface to the minimum irreducible set.

## Bottom Line

The best low conflict architecture is not "Deck plus many fork patches in core".

It is:

- generic protocol and runtime improvements accepted upstream
- Deck specific projections moved to Deck owned seams
- only the smallest unavoidable fork specific control plane left outside upstream

That is the boundary condition for the next discussion about whether pushing compromise and complexity into Deck is the better strategy.
