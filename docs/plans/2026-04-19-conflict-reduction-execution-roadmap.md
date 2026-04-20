# Conflict Reduction Execution Roadmap

## Purpose

Turn the earlier audit and architecture conclusions into an execution sequence.

This document answers:

1. What should be done first?
2. What can be deferred?
3. What concrete artifacts prove that conflict pressure is actually going down?

## Inputs

This roadmap depends on:

- `docs/plans/2026-04-19-enhanced-core-diff-audit.md`
- `docs/plans/2026-04-19-enhanced-conflict-reduction-classification.md`
- `docs/plans/2026-04-19-zero-conflict-migration-blueprint.md`

## Success Metric

The real metric is not lines removed. It is conflict surface removed from upstream hot files.

Track progress using these leading indicators:

- fewer fork owned edits in `src/gateway/server-methods-list.ts`
- fewer fork owned edits in `src/gateway/method-registry-data.ts`
- fewer fork owned edits in `src/gateway/protocol/schema/*`
- fewer fork owned edits in `src/plugins/*`
- fewer Deck specific semantics encoded in `src/config/*`
- fewer rebased commits requiring manual conflict resolution in shared core files

## Workstreams

Use four parallel workstreams, but sequence them carefully.

### Workstream A. Upstream generic protocol foundation

Scope:

- `MethodRegistry`
- `gateway.describe`
- generic method metadata
- generic result schemas

Why first:

- this lowers conflict in the single highest value shared area
- later Deck adapter work depends on a stable discovery surface

### Workstream B. Deck adapter extraction

Scope:

- auth and provider provenance
- transcript shaping
- event filtering
- Deck management projections

Why second:

- this is where most fork specific pressure should move

### Workstream C. Plugin metadata decoupling

Scope:

- `setupWizardSpec`
- Deck locales
- Deck action capability metadata
- generated Deck plugin registry artifact

Why third:

- lower urgency than Gateway protocol
- still important because `src/plugins/*` is a shared churn area

### Workstream D. Deck RPC contraction

Scope:

- remove or relocate `deck.*` RPCs from shared core files

Why last:

- this is the hardest and most product sensitive change
- it should only start after A and B exist

## Phase Plan

## Phase 0. Freeze New Divergence

Objective:

- stop making the problem worse while migration is in progress

Rules:

- no new Deck specific fields in generic plugin manifests
- no new Deck specific schema additions in shared protocol files unless they are clearly upstreamable
- no new management view projection logic in shared core runtime unless required to unblock production

Deliverables:

- this roadmap checked into the repo
- team rule that new Deck only capability defaults to adapter first, not core first

Exit criteria:

- no new fork only changes land in `src/gateway/*`, `src/plugins/*`, or `src/config/*` without an explicit seam justification

## Phase 1. Upstreamability Slice

Objective:

- extract the generic changes that should stop being fork only

Priority items:

1. `MethodRegistry`
2. `gateway.describe`
3. non Deck method metadata
4. generic result schemas
5. Windows `schtasks` hardening
6. generic bundled plugin compatibility fixes

Recommended order:

1. prepare minimal generic patchset for registry and describe
2. split Deck references out of comments and tests
3. prepare separate patchsets for metadata families
4. upstream Windows and bundled runtime fixes independently

Why split it this way:

- smaller generic PRs are easier to land than a single giant Deck motivated delta

Deliverables:

- upstream ready patch branches
- issue list of what upstream accepts, rejects, or partially accepts

Exit criteria:

- either accepted upstream or cleanly isolated as a fork patch waiting for the next attempt

Evidence of success:

- reduced custom logic in `src/gateway/method-registry.ts`
- reduced fork only ownership of `src/gateway/server-methods/describe.ts`
- smaller fork diff in `src/gateway/protocol/schema/*`

## Phase 2. Externalize Protocol Tooling

Objective:

- stop keeping Deck codegen and coverage workflows inside shared runtime ownership

Move out:

- `scripts/protocol-gen-ts.ts`
- `scripts/protocol-coverage-check.ts`
- `scripts/lib/protocol-coverage-report.ts`
- `scripts/deck-gap-report.ts`

Target:

- Deck owned tooling package or `deck-tools/`

Design principle:

- generate from `gateway.describe` plus optional exported metadata snapshots
- do not require editing core runtime files to evolve Deck codegen

Deliverables:

- Deck tooling entrypoint
- generated client artifacts produced outside core
- updated documentation for the new generation path

Exit criteria:

- deleting Deck tooling from shared runtime scripts does not reduce runtime capability

Evidence of success:

- shared `scripts/**` no longer contains Deck protocol generation logic

## Phase 3. Build Deck Adapter MVP

Objective:

- create the first backend style seam owned entirely by Deck

Minimum responsibilities:

1. provider provenance aggregation
2. auth overview and auth probe orchestration
3. transcript normalization for Deck consumption
4. event stream projection or filtering
5. plugin setup metadata materialization

Non goals for MVP:

- do not solve every `deck.*` RPC
- do not fully replace current Gateway integration on day one

Preferred interface:

- HTTP JSON endpoints or a small RPC namespace owned by the adapter

Data sources:

- upstream Gateway APIs
- config files
- auth profile store
- generated Deck plugin registry artifact
- session transcripts if needed

Deliverables:

- adapter service skeleton
- first thin contract consumed by one or two Deck pages
- compatibility tests against current local Gateway behavior

Exit criteria:

- at least one auth or model management page stops depending on Deck specific core runtime patches

Evidence of success:

- `models.configured`, `models.catalog.providers`, or `deck.auth.*` logic starts moving out of shared core files

## Phase 4. Plugin Metadata Decoupling

Objective:

- remove Deck only metadata from generic plugin manifest flow

Move out of shared core:

- `deck.setupWizardSpec`
- Deck locale metadata in generic manifest snapshots
- Deck action capabilities in generic plugin manifest types

Target design:

- generated Deck plugin registry artifact
- optional Deck companion metadata file per plugin
- adapter side ingestion of that artifact

Migration strategy:

1. create generated artifact side by side with current manifest path
2. make adapter read generated artifact first
3. switch frontend to adapter output
4. remove dependence on core manifest extensions

Deliverables:

- artifact format
- build generator
- migration compatibility layer

Exit criteria:

- shared plugin manifest types no longer need Deck only fields

Evidence of success:

- reduced fork diff in `src/plugins/manifest.ts`, `src/plugins/manifest-registry.ts`, and `src/plugins/registry-types.ts`

## Phase 5. Move Transcript And Event Semantics Out Of Core

Objective:

- stop encoding Deck readability and subscriber policy in upstream hot chat paths

Move out:

- transcript canonicalization for UI
- tool result shaping for whitebox display
- Deck specific event stream filtering

Possible retained upstream pieces:

- generic structured transcript schema if upstream accepts it
- generic media robustness if upstream accepts it

Adapter responsibilities after migration:

- normalize mixed legacy transcript content
- shape tool result payloads for Deck rendering
- filter or regroup streams for Deck clients

Deliverables:

- transcript projection module in adapter
- adapter event contract for Deck
- removal plan for core side filtering where possible

Exit criteria:

- Deck chat pages no longer require shared core runtime to emit Deck optimized shapes

Evidence of success:

- smaller fork diff in `src/gateway/server-chat.ts`
- smaller fork diff in `src/gateway/server-methods/chat.ts`
- smaller fork diff in `src/gateway/transcript-canonical.ts`
- smaller fork diff in `src/gateway/server-node-subscriptions.ts`

## Phase 6. Contract Deck RPCs To The Irreducible Minimum

Objective:

- reduce `deck.*` in shared core to the smallest unavoidable set, or remove it completely

Approach:

1. inventory every `deck.*` method by user facing capability
2. mark each as one of:
   - replaceable by adapter composition
   - replaceable by upstream generic API plus adapter
   - truly requires a runtime host seam
3. kill the replaceable ones first

Expected result:

- some `deck.*` methods disappear entirely
- some become adapter endpoints
- a very small subset may remain pending a better pluginized host seam

Deliverables:

- per method contraction matrix
- delete list for obsolete `deck.*` handlers
- adapter replacements

Exit criteria:

- shared core registration files no longer carry broad Deck product surface

Evidence of success:

- much smaller diff in `src/gateway/server-methods-list.ts`
- much smaller diff in `src/gateway/server-methods.ts`
- much smaller diff in `src/gateway/method-scopes.ts`

## Suggested Order Inside Each Major Concern

### Protocol

Do first:

- `MethodRegistry`
- `gateway.describe`
- generic result schemas

Do later:

- Deck specific codegen consumers

### Auth and models

Do first:

- provider provenance and auth overview in adapter

Do later:

- probe and advanced diagnostics

### Plugins

Do first:

- generated Deck registry artifact

Do later:

- removing all Deck fields from core manifest types

### Chat and transcripts

Do first:

- read time normalization in adapter

Do later:

- deleting write time normalization in core

## Risks By Phase

### Phase 1 risk

- upstream may reject some generic infrastructure or want a different shape

Mitigation:

- split into narrow PRs

### Phase 3 risk

- adapter duplicates some runtime logic or drifts from real behavior

Mitigation:

- contract tests against local Gateway outputs

### Phase 4 risk

- plugin metadata generation becomes another source of drift

Mitigation:

- generated artifact check in CI

### Phase 5 risk

- UI regressions if transcript or event semantics change too quickly

Mitigation:

- dual read path during migration

### Phase 6 risk

- some `deck.*` methods may hide deeper runtime coupling than expected

Mitigation:

- per method contraction matrix before deletion

## What To Measure Every Two Weeks

Track these numbers repeatedly:

1. fork owned diff count under `src/gateway/**`
2. fork owned diff count under `src/plugins/**`
3. number of `deck.*` methods still registered in shared core
4. number of Deck management pages still depending on core patched endpoints
5. number of rebases requiring manual fixes in shared core files

If these are not falling, the migration is not working.

## Recommended First 30 Days

The best first month is:

1. freeze new divergence
2. isolate upstreamable protocol core into patchsets
3. create Deck adapter skeleton
4. move one auth or models page to adapter data
5. define generated Deck plugin registry artifact

Do not start by rewriting all `deck.*` handlers.

That is too late stage and too risky as a first move.

## Recommended First Concrete Pull Requests

PR 1:

- add repo policy note that Deck only behavior defaults to adapter first

PR 2:

- separate generic registry and describe infrastructure from Deck framing

PR 3:

- create Deck adapter scaffold with one endpoint for provider provenance or auth overview

PR 4:

- create generated Deck plugin registry artifact and loader

PR 5:

- migrate first Deck page away from core patched auth or model endpoints

## Definition Of Done For "Conflict Near Zero"

The migration is successful when all of these are true:

- generic protocol and runtime fixes are upstreamed or no longer fork only
- Deck codegen and protocol coverage tooling live outside shared runtime ownership
- Deck metadata projections no longer require generic plugin manifest expansion
- transcript and event shaping for Deck no longer require shared core hot path patches
- `deck.*` no longer broadly modifies shared registration files
- rebasing upstream no longer routinely produces manual conflicts in shared core files

## Final Execution Rule

Whenever there is a choice between:

- one more convenient patch in shared core
- one more piece of complexity inside a Deck owned seam

choose the Deck owned seam, unless the change is generic enough to upstream.

That rule is the practical enforcement mechanism behind the zero conflict strategy.
