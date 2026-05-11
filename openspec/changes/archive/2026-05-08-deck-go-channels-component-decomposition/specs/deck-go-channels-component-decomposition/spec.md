## ADDED Requirements

### Requirement: Channels panel is decomposed into stable module-local surfaces

The production channels panel SHALL be decomposed into a thin orchestrator plus module-local `types`, `lib`, `views`, `tabs`, `parts`, `dialogs`, and fixture files without changing the existing channels product behavior.

#### Scenario: Target component structure exists

- **WHEN** the change is implemented
- **THEN** `deck-go/frontend-new/src/components/panels/channels/` SHALL contain module-local surfaces for channel selectors, list view, detail view, tabs, parts, dialogs, and fixtures
- **AND** `ChannelsPanel.tsx` SHALL remain as the orchestrator that wires data, state, mutations, and callbacks
- **AND** the implementation SHALL NOT create a production `CreateChannelDialog` or channel creation wizard in this change

#### Scenario: ChannelsPanel remains reviewable

- **WHEN** implementation is ready for review
- **THEN** `ChannelsPanel.tsx` SHALL be reduced to orchestrator responsibilities
- **AND** `ChannelsPanel.tsx` SHOULD target 400-550 lines
- **AND** `ChannelsPanel.tsx` MUST NOT exceed 700 lines unless the task evidence records a concrete reason and follow-up

### Requirement: New presentation components preserve frontend data boundaries

Newly extracted `views`, `tabs`, `parts`, and `dialogs` SHALL receive data and callbacks through props and SHALL NOT own production server-state reads, mutations, raw API calls, Gateway calls, or navigation-store access.

#### Scenario: New components do not bypass the orchestrator

- **WHEN** a reviewer scans newly extracted `views`, `tabs`, `parts`, and `dialogs`
- **THEN** those files SHALL NOT import React Query, `frontend-new/src/data/modules/*`, `frontend-new/src/api.ts`, Gateway clients, or navigation stores
- **AND** production network calls SHALL remain in `ChannelsPanel.tsx` or existing smart components explicitly exempted by this change

#### Scenario: Existing smart components remain explicit exceptions

- **WHEN** `TabSettings` or `TabWeComAccess` renders settings, account policy, or WeCom access behavior
- **THEN** it MAY compose the existing `ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, or `WecomRoutingSummary`
- **AND** this change SHALL NOT require those existing smart components to become dumb props components
- **AND** this change SHALL NOT change their public interfaces or internal write paths

### Requirement: Routing tab is presentation-only

The channels routing tab SHALL render routing state from props while routing data loading and routing navigation remain owned by `ChannelsPanel.tsx`.

#### Scenario: Routing data is passed into TabRouting

- **WHEN** the selected channel/account changes and routing information is needed
- **THEN** `ChannelsPanel.tsx` SHALL own the routing query state using the existing Data Fabric/API path
- **AND** `TabRouting` SHALL receive routing response, loading state, error state, channel id, account id, and `onOpenRouting` callback by props

#### Scenario: Routing tab opens routing through a parent callback

- **WHEN** the operator activates the routing handoff from the channels routing tab
- **THEN** `TabRouting` SHALL call the callback provided by `ChannelsPanel.tsx`
- **AND** `TabRouting` SHALL NOT directly access `useDeckUI`, routing stores, or raw route strings

### Requirement: Channels selectors are deterministic and testable

Channel normalization, account diagnostics, filters, counts, and throughput summary derivation SHALL be moved into deterministic module-local selector/helper code with focused tests.

#### Scenario: Selector tests cover product states

- **WHEN** selector tests run
- **THEN** they SHALL cover channel/account normalization, diagnostic tone derivation, alert counts, stable and payload-derived filters, WeCom filter availability, and throughput summary derivation
- **AND** selector tests SHALL use contract-shaped fixtures rather than fabricated server-only fields

#### Scenario: Empty and filtered states remain explainable

- **WHEN** channel data is empty or local filters/search hide available rows
- **THEN** list/view behavior SHALL continue to distinguish true-empty from filtered-empty
- **AND** filtered-empty state SHALL provide clear recovery through existing or extracted clear-filter behavior

### Requirement: Current channel workflows do not regress

The decomposition SHALL preserve the existing contract-backed channels workflows for inventory, selection, account diagnostics, probe, throughput, logout confirmation, settings/account policy edits, WeCom access controls, routing handoff, plugin navigation, and refresh.

#### Scenario: Existing panel scenarios still pass

- **WHEN** `ChannelsPanel.test.tsx` runs after decomposition
- **THEN** the existing panel behavior scenarios SHALL still pass or be updated only to match equivalent extracted-component rendering
- **AND** the change SHALL NOT reduce semantic coverage of the current 10 panel behavior scenarios

#### Scenario: Channel config patch semantics are preserved

- **WHEN** settings or account policy behavior calls the channel config patch path
- **THEN** the frontend SHALL continue to call `patchChannelConfig(channelId, patch)` without a client-provided `baseHash`
- **AND** error display SHALL preserve the existing backend-derived baseHash and upstream-error-preserved semantics

#### Scenario: Unsupported channel creation remains unavailable

- **WHEN** the channels page renders a new-channel affordance
- **THEN** it SHALL remain disabled or explicitly unavailable according to current production behavior
- **AND** the UI SHALL NOT present channel creation as a supported workflow in this change

### Requirement: Verification separates structural, mock visual, and real Gateway evidence

The change SHALL be verified with focused structural tests, frontend build, mock visual smoke, and optional bounded real Gateway evidence without conflating those layers.

#### Scenario: Focused tests and build pass

- **WHEN** implementation is complete
- **THEN** focused channels component/unit tests SHALL pass
- **AND** `cd deck-go && make frontend-build` SHALL pass
- **AND** task completion SHALL cite fresh command output

#### Scenario: Mock visual smoke remains current

- **WHEN** `test/e2e/channels-visual.spec.ts` runs
- **THEN** it SHALL pass and produce the current seven screenshot artifact states without unexpected console/page/API errors
- **AND** the evidence SHALL describe this as mock visual smoke rather than pixel-level visual diff

#### Scenario: Real Gateway smoke is bounded

- **WHEN** real Gateway channels smoke is run
- **THEN** it SHALL exercise only safe read/UI behavior unless disposable mutation state is available
- **AND** unsafe mutation scenarios without safe isolation SHALL be marked skipped-safe or deferred with evidence rather than run against ambiguous user configuration
- **AND** real Gateway evidence SHALL be reported separately from mock visual evidence
