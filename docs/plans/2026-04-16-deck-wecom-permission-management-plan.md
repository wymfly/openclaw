# Deck WeCom Permission Management Execution Baseline

**Date:** 2026-04-16
**Status:** Approved
**Authority:** Current authoritative execution baseline for Deck WeCom permission management
**Inputs:** [Original design input](/plans/2026-04-16-deck-wecom-permission-management-design), current Deck Channels and Plugins surfaces, current WeCom config model

## Decision Summary

This plan replaces the original design document as the execution baseline.

The original design intent remains valid: Deck needs a usable permission-management surface for WeCom. The old information architecture does not. The current product already has separate `channels`, `plugins`, and `routing` surfaces, and this plan preserves that split.

## Scope Preservation Rule

This baseline follows the original design direction unless there is a strong, explicit reason not to.

Allowed changes:

- refactor the information architecture
- rehome features to a better surface
- strengthen contracts and ownership boundaries
- change the implementation sequence

Disallowed by default:

- silently dropping features from the original design
- converting original in-scope features into open-ended future work
- weakening operator capability just because the original tab structure changed

If any feature must be deferred, the plan or implementation follow-up must state all of the following:

1. the exact blocker
2. why the blocker is strong enough to prevent safe delivery now
3. what minimum operator-facing behavior will still ship now
4. what follow-up contract or implementation step removes the blocker

## Verified Current Reality

The current baseline is grounded in the codebase:

- `ChannelDetail` is still a 4-tab surface: `status`, `bindings`, `settings`, `analytics`
- Routing already exists as a separate panel with its own simulator and API surface
- Plugins Inventory already exists as a separate panel
- WeCom already has real config/runtime concepts for:
  - DM policy
  - `allowFrom`
  - `dynamicAgents.*`
  - `routing.failClosedOnDefaultRoute`

## Surface Responsibilities

### Channels

Channels remain the runtime and operations surface. They may show and edit permission behavior that belongs to `channels.wecom.*`.

Allowed responsibilities:

- connection health
- probe and account diagnostics
- permission summaries
- DM policy editing
- `allowFrom` editing
- WeCom dynamic-agent editing
- routing behavior toggles that belong to `channels.wecom.routing.*`
- channel-scoped warnings and guidance

Disallowed responsibilities:

- plugin install/update/uninstall
- plugin source-of-truth inventory
- plugin activation state ownership
- global routing management UI duplication

### Plugins

Plugins remain the inventory and capability surface.

Allowed responsibilities:

- plugin identity
- plugin origin
- plugin capability summary
- plugin diagnostics
- plugin config key visibility

Disallowed responsibilities:

- channel runtime operations
- channel account health
- per-account permission editing

### Routing

Routing remains a separate surface.

Allowed responsibilities:

- binding management
- route simulation
- routing conflict analysis
- global routing diagnostics

Channel pages may only provide:

- routing summary
- routing warnings
- deep links into the Routing panel

## Config Ownership

The implementation must keep these ownership boundaries explicit.

### Channel-owned config

These remain editable from Channels:

- `channels.wecom.accounts.<id>.bot.dm.*`
- `channels.wecom.accounts.<id>.agent.dm.*`
- `channels.wecom.dynamicAgents.*`
- `channels.wecom.routing.failClosedOnDefaultRoute`

### Plugin-owned config

These do not move into the Channels permission UI:

- `plugins.entries.wecom.*`

Channels may display minimal plugin-aware context such as plugin id, origin, and config key, but they do not become the plugin lifecycle or plugin inventory surface.

## UX Baseline

## Channel Detail Target

Execution should start from the current 4-tab reality and evolve incrementally.

### Current reality

`Status | Bindings | Settings | Analytics`

### Target near-term structure

`Status | Access | Bindings | Settings | Analytics`

This is the approved target for the next implementation baseline.

Important constraints:

- do **not** create a Channel-local Routing primary tab
- do **not** rename `Analytics` to `Metrics` until a stable Gateway metrics contract exists
- do **not** treat the old 5-tab design as current reality

### Status tab

Retains runtime operations:

- connection probe
- account status
- logout / reconnect flows
- channel diagnostics

Add read-only permission summary and config warnings here when useful, but do not turn Status into the main editing surface.

### Access tab

This becomes the dedicated permission-editing surface for channel-owned access behavior.

Generic sections:

- per-account DM policy
- `allowFrom` editor
- routing behavior summary and fail-closed toggle

WeCom-specific sections:

- dynamic agent settings
- admin users
- bot vs agent permission sections when both modes are configured

### Bindings tab

Keep the existing channel-local bindings view.

Enhance it only with:

- routing summary
- conflict or missing-binding warnings
- deep links into the global Routing panel

Do not duplicate the Routing panel or Route Simulator here.

### Settings tab

Retain technical configuration only:

- credentials
- transport
- retry
- network
- media

Access-related fields should be excluded once the Access tab owns them.

### Analytics tab

Do not defer metrics wholesale.

Current execution should ship the best operator-facing metrics or audit surface that can be supported safely from current Deck and Gateway realities. If some metrics behavior still requires a new Gateway contract, that contract gap must be treated as a narrow blocker, not as a reason to drop the whole feature from scope.

Minimum expectation:

- preserve a visible channel metrics or analytics surface
- improve it where current data already exists
- enumerate any contract-blocked gaps explicitly during implementation instead of silently postponing them

## Traceability to Original Design

This section makes the scope mapping explicit so the original design intent is not lost during refactoring.

| Original design item                        | Baseline disposition                                         | Notes                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Overview permission summary + config alerts | **Preserved, rehomed**                                       | Runtime summary and warnings stay in Channels. Exact layout may differ from the original 5-tab proposal.        |
| Access tab for permission editing           | **Preserved**                                                | Access remains the dedicated editing surface for permission behavior.                                           |
| `AllowFromEditor`                           | **Preserved**                                                | Must exist as a first-class editing surface, not an implicit follow-up step.                                    |
| Dynamic Agent Panel                         | **Preserved**                                                | Remains WeCom-specific and stays in the Access surface.                                                         |
| Account switcher / multi-account handling   | **Preserved**                                                | Required whenever multiple WeCom accounts are present.                                                          |
| Bot vs Agent DM policy handling             | **Preserved**                                                | Dual-mode accounts must remain explicit in the UX.                                                              |
| Routing behavior section                    | **Preserved**                                                | The toggle/behavior belongs in Access; full routing management stays in Routing.                                |
| Route Simulator                             | **Preserved, rehomed**                                       | Simulator remains required, but lives in the standalone Routing surface instead of a Channel-local primary tab. |
| Settings tab slimming                       | **Preserved**                                                | Access-owned fields should move out of Settings once the Access flow is complete.                               |
| Metrics tab                                 | **Preserved, implementation may narrow by current contract** | Do not drop the feature. Any blocked portion must be explicitly justified and bounded.                          |
| Generic + WeCom-specific extension model    | **Preserved in principle**                                   | Generic access primitives remain reusable; WeCom-specific sections remain isolated where needed.                |

## WeCom-specific UX Rules

### AllowFrom editing

`allowFrom` editing is a first-class requirement. Any Access UI is incomplete without it.

Requirements:

- tag-input editing
- bulk import
- normalization for WeCom identifiers
- wildcard support
- empty-allowlist warnings when policy is `allowlist`

### Dynamic agents

Dynamic agents stay WeCom-specific.

Required editable fields:

- `enabled`
- `dmCreateAgent`
- `groupEnabled`
- `adminUsers`

Required warnings:

- enabled with empty `adminUsers`
- enabled with no useful routing/binding context

### Bot and agent dual-mode handling

If a WeCom account has both bot and agent modes configured, the Access UI must render both sections explicitly instead of collapsing them into one ambiguous DM policy editor.

## Explicit Out of Scope

The following items are not in the current execution scope:

- plugin lifecycle controls in Channels
- plugin install/update/uninstall from this flow
- replacing the standalone Plugins Inventory panel
- replacing the standalone Routing panel
- treating the original design document as the authoritative execution baseline

## Execution Phases

### Phase 1

Document authority handoff and implementation baseline alignment.

Artifacts:

- this execution-baseline document
- authority downgrade note in the original design doc

### Phase 2

Add the `Access` tab and move WeCom permission editing there without breaking current runtime surfaces.

### Phase 3

Slim `Settings` by removing duplicated access-related controls after the Access flow is feature-complete.

### Phase 4

Improve cross-surface deep links and warnings across Channels, Plugins, and Routing.

## Acceptance Criteria

This baseline is complete only if the following remain true:

1. The original design doc is no longer presented as the current authoritative execution baseline.
2. This document is the authoritative baseline for follow-up work.
3. The baseline explicitly separates:
   - Channels
   - Plugins
   - Routing
4. The baseline explicitly separates:
   - `channels.wecom.*`
   - `plugins.entries.wecom.*`
5. The baseline does not treat the old 5-tab layout as the current implementation reality.
6. The baseline does not include a Metrics redesign in the current execution scope.

## Verification

Verify future implementation and future doc edits against these concrete code surfaces:

- `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- `dashboard/src/components/panels/plugins/PluginsPanel.tsx`
- `dashboard/src/components/panels/routing/RoutingPanel.tsx`
- `dashboard/src/components/panels/routing/RouteSimulator.tsx`
- `dashboard/src/lib/panel-registry.ts`
- `extensions/wecom/src/config/schema.ts`
- `extensions/wecom/src/dynamic-agent.ts`

For this document update itself, the minimum gate is:

- `git diff --check`
