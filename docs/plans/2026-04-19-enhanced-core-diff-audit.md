# Enhanced Core Diff Audit Against Upstream v2026.4.15

## Purpose

This note records what the `enhanced` branch changed in the OpenClaw core after the last confirmed upstream sync point, excluding the standalone `dashboard/`, `extensions/`, `deploy/`, and docs surfaces.

It is intended to answer two questions:

1. What core code did the fork change beyond adding Deck and extra extensions?
2. Which of those changes are likely to keep causing rebase conflicts against upstream?

## Baseline

- Audit date: 2026-04-19
- Current branch: `enhanced`
- Current `enhanced` HEAD: `3df713fe5c`
- Current `upstream/main`: `dc3df91e95` (`v2026.4.19-beta.2`)
- Last confirmed shared baseline with upstream: `0c0463b2b7`
- Baseline upstream tag: `v2026.4.15`
- Baseline commit subject: `fix: restore allowPrivateNetwork for self-hosted STT endpoints (#66692)`

At audit time:

- `enhanced` is `773` commits ahead of the baseline.
- `upstream/main` is `962` commits ahead of the same baseline.

This means the branch is not currently aligned with the latest upstream. For this audit, all comparisons are against `0c0463b2b7..HEAD`.

## Scope

Included:

- `src/**`
- `scripts/**`
- package and workspace metadata that affect runtime or verification
- tests that lock the modified behavior

Excluded:

- `dashboard/**`
- `extensions/**`
- `deploy/**`
- `docs/**`
- `openspec/**`
- local OMX and brainstorming state

Two counting modes are useful:

1. Full core hosted delta
   Includes Deck support implemented inside core runtime under `src/`.
2. Cross cutting core delta
   Excludes Deck only Gateway handlers under `src/gateway/server-methods/deck/**` and the Deck specific schema file `src/gateway/protocol/schema/deck.ts`.

## Size Summary

Full core hosted delta, excluding dashboard, extensions, deploy, docs, and process artifacts:

- `151` files changed
- `21923` insertions
- `963` deletions

Cross cutting core delta after excluding Deck only Gateway handlers and Deck schema:

- `110` files changed
- `7809` insertions
- `62` deletions

Cross cutting change concentration by top level area:

- `src/gateway`: `69` files
- `src/agents`: `10` files
- `src/config`: `8` files
- `src/plugins`: `7` files
- `src/channels`: `4` files
- `src/daemon`: `3` files

## Main Change Groups

### 1. Gateway protocol registry and typed introspection

Representative files:

- `src/gateway/method-registry.ts`
- `src/gateway/server-methods/describe.ts`
- `src/gateway/method-registry-data.ts`
- `src/gateway/server-methods/*-method-defs.ts`
- `scripts/protocol-gen-ts.ts`
- `scripts/protocol-coverage-check.ts`
- `scripts/deck-gap-report.ts`

What changed:

- Added a first class `MethodRegistry` that combines handlers, schemas, scopes, versioning metadata, and event definitions.
- Added `gateway.describe` so clients can introspect the live method surface and schema version.
- Introduced method metadata files for many Gateway method families.
- Added TypeScript code generation for Gateway protocol types and typed client allowlists.
- Added coverage and gap detection scripts to compare registered methods, typed methods, and Deck usage.

Why it exists:

- Deck needs a typed Gateway client instead of brittle string based RPC calls.
- Rebase recovery needed a systematic way to identify which upstream methods gained or lost schemas.
- The fork needs a stable contract layer on top of upstream Gateway handlers.

Why it causes rebase cost:

- It changes exactly the files that upstream also changes often:
  `src/gateway/server-methods-list.ts`, `src/gateway/protocol/schema/*`, and Gateway handler registration code.
- The fork maintains extra metadata that upstream does not own, so every upstream method addition can create follow up work.

Risk level for future rebases: high

### 2. Core hosted Deck protocol surface

Representative files:

- `src/gateway/server-methods/deck/**`
- `src/gateway/protocol/schema/deck.ts`
- `src/gateway/server-methods/deck-auth.ts`

What changed:

- Added a large `deck.*` Gateway RPC surface inside the core server.
- Added Deck auth overview and probe handlers on the Gateway side.
- Added Deck specific schemas, scopes, and typed metadata for those methods.

Why it exists:

- Deck is not just a separate UI. It depends on new Gateway capabilities that upstream does not provide.
- Keeping these handlers in core allows the local Gateway to serve the Deck dashboard directly.

Why it causes rebase cost:

- It increases the amount of fork owned protocol surface under `src/gateway`.
- Any upstream refactor in method registration, session state, model catalog, or agent config tends to touch the same core files.

Risk level for future rebases: high

### 3. Model catalog, auth visibility, and provider provenance

Representative files:

- `src/agents/auth-diagnostics.ts`
- `src/agents/provider-defaults.ts`
- `src/gateway/server-methods/models.ts`
- `src/gateway/server-methods/models-catalog-providers.ts`
- `src/gateway/server-methods/model-provider-provenance.ts`
- `src/commands/models/list.probe.ts`

What changed:

- Added `buildAuthOverview` to summarize provider readiness, auth type, cooldown, OAuth expiry, and usage.
- Extended `models.list` and `models.configured` so configured models inherit cost and token limits from runtime catalog data.
- Added visibility into providers coming from config, auth profiles, env vars, and agent local `models.json`.
- Added `models.catalog.providers` as a provider grouped catalog view.
- Added auth probe behavior used by Deck to test provider readiness.

Why it exists:

- Deck needs to explain where a provider comes from, whether it is editable, and why it is unavailable.
- Upstream model surfaces are not rich enough for a management UI.

Why it causes rebase cost:

- These changes sit in upstream owned model and auth plumbing.
- Upstream refactors to provider loading, auth profiles, or model catalog shape will tend to conflict semantically.

Risk level for future rebases: medium to high

### 4. Event stream filtering for channel and node subscribers

Representative files:

- `src/config/types.agent-defaults.ts`
- `src/config/types.agents.ts`
- `src/config/zod-schema.agent-defaults.ts`
- `src/config/zod-schema.agent-runtime.ts`
- `src/gateway/channel-event-filter.ts`
- `src/gateway/server-node-subscriptions.ts`

What changed:

- Added `channels.eventStreams` to agent defaults and agent entries.
- Added runtime filtering so node subscribers only receive configured streams such as `lifecycle` or `assistant`.
- Kept non agent events and error streams unfiltered.

Why it exists:

- Deck and other subscribers do not always want the full firehose of `thinking`, `tool`, and lifecycle updates.
- This reduces noisy UI updates and transport overhead.

Why it causes rebase cost:

- It touches core config schema and a hot path in Gateway session broadcasting.
- Those are upstream owned surfaces with frequent churn.

Risk level for future rebases: medium

### 5. Transcript contract, tool payload normalization, and richer chat media

Representative files:

- `src/gateway/protocol/schema/transcript.ts`
- `src/gateway/transcript-canonical.ts`
- `src/gateway/server-chat.ts`
- `src/gateway/server-methods/chat.ts`
- `src/gateway/server-methods/nodes.handlers.invoke-result.ts`
- `src/media-understanding/apply.ts`
- `src/media/mime.ts`

What changed:

- Defined structured transcript blocks for text, thinking, tool use, tool result, image, and file payloads.
- Added canonicalization for legacy or mixed transcript payloads before persistence and broadcast.
- Normalized session tool payloads so tool results can be rendered consistently.
- Added support for non image file attachments and richer media typing.
- Added A2UI event forwarding from node invoke results.
- Added text heuristics that recover text like content from binary classified files.

Why it exists:

- Deck chat views need stable structured transcript data, not ad hoc text blobs.
- Tool results, media, and Canvas or A2UI actions need a predictable contract.

Why it causes rebase cost:

- Chat, transcripts, and media handling are also active upstream surfaces.
- The fork changed both schema and runtime behavior, so conflicts are often semantic, not just textual.

Risk level for future rebases: high

### 6. Plugin manifest driven metadata and bundled runtime compatibility

Representative files:

- `src/plugin-sdk/wizard-spec.ts`
- `src/plugins/manifest.ts`
- `src/plugins/manifest-registry.ts`
- `src/plugins/loader.ts`
- `src/plugins/registry-types.ts`
- `src/channels/plugins/bundled.ts`
- `src/channels/plugins/catalog.ts`
- `scripts/copy-bundled-plugin-metadata.mjs`
- `scripts/stage-bundled-plugin-runtime-deps.mjs`

What changed:

- Expanded plugin manifests with Deck facing metadata such as `setupWizardSpec`, locales, and action capabilities.
- Added a typed wizard spec contract in the plugin SDK.
- Moved more plugin UI metadata into manifest snapshots instead of runtime probing.
- Preserved backward compatibility for legacy bundled channel exports.
- Adjusted bundled runtime staging to relocate or avoid nested `node_modules` trees.

Why it exists:

- Deck wants plugin setup and channel metadata without eagerly loading full plugin runtime.
- The fork also needs bundled plugin packaging to survive release and deployment flows.

Why it causes rebase cost:

- This area is less volatile than Gateway protocol, but it still modifies shared plugin loader and manifest code.
- Conflicts tend to happen when upstream changes plugin discovery or channel plugin loading.

Risk level for future rebases: medium

### 7. Windows service reliability and restart loop support

Representative files:

- `src/daemon/schtasks.ts`
- `src/daemon/service-audit.ts`

What changed:

- Added restart loop parsing and control flow awareness for generated Windows task scripts.
- Added fallback and parsing hardening around `schtasks`.
- Improved service audit behavior for Windows service management.

Why it exists:

- This is a fork specific operational enhancement, not a Deck requirement.
- It supports more reliable Windows gateway deployment and recovery.

Why it causes rebase cost:

- These files overlap with upstream Windows service maintenance work.
- The surface is small, but conflicts are still possible when upstream changes task generation or status parsing.

Risk level for future rebases: medium

## Independent Enhancements That Are Not Just Deck Support

These changes are core modifications but are not purely Deck driven:

- Windows `schtasks` restart loop and service audit hardening
- bundled channel compatibility for legacy exports
- nested `node_modules` relocation in bundled metadata staging
- richer model catalog and provider provenance that also benefits non Deck diagnostics
- non image attachment handling and text heuristic recovery

## Conflict Hotspots To Expect On Future Rebases

The most conflict prone files or file families are:

- `src/gateway/server-methods-list.ts`
- `src/gateway/method-registry-data.ts`
- `src/gateway/method-registry.ts`
- `src/gateway/protocol/schema/*`
- `src/gateway/server-methods/*-method-defs.ts`
- `src/gateway/server-methods/models.ts`
- `src/gateway/server-methods/chat.ts`
- `src/gateway/server-chat.ts`
- `src/plugins/manifest.ts`
- `src/plugins/loader.ts`

If future work aims to reduce rebase pain, these are the best candidates for seam extraction or upstreamable refactors.

## Practical Reading Of The Delta

The fork core changes are not one homogeneous layer.

- One part is a large core hosted Deck protocol surface.
- One part is a cross cutting protocol and schema adapter layer added so Deck can rely on typed Gateway contracts.
- One part is general fork hardening and operations work that would still exist without Deck.

The protocol adapter layer is the main reason rebases stay expensive. It sits directly on top of upstream active files and must be refreshed whenever upstream changes Gateway methods, result shapes, or registration patterns.

## Representative Commit Landmarks

Useful commits when tracing why a core layer exists:

- `38fd78877d` Move Deck plugin metadata onto the manifest backed snapshot path
- `4ca34a5027` Add setupWizardSpec transport for Deck wizard groundwork
- `26e538ce25` fix(bundled): walk nested node_modules + support legacy channel exports
- `349b3dd1c3` feat: add Windows schtasks restart loop for crash recovery
- `f7f5dd05ef` feat(gateway): add auth-diagnostics shared module
- `90a4e0308c` feat(gateway): assemble MethodRegistry and add gateway.describe RPC
- `80a4f58db9` feat(gateway): add TypeScript protocol codegen script
- `24d010b772` feat(config): add channels.eventStreams field for channel event filtering
- `611a21da47` feat(gateway): support non-image file attachments in chat
- `b8a84ae13f` feat(deck-chat): implement canonical transcript contract
- `55cbc6defb` feat(protocol-sdk): add methodDefs for P0-P1 upstream adaptation
- `bd0fa7403b` fix(protocol-sdk): restore fork-only result schemas and methodDefs after upstream rebase

## Suggested Next Step

If the goal is to make future upstream rebases cheaper, the next useful artifact is a second pass that labels each modified core file as one of:

- can likely be upstreamed
- can be isolated behind a fork only seam
- must stay as a long lived fork patch

That classification would turn this audit into an actionable rebase reduction plan.
