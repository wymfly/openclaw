# Enterprise Agent Platform Core — Minimum Architecture

## Purpose

Define the smallest credible architecture for a future enterprise-grade agent
platform core when:

- `OpenClaw` is treated as a runtime leaf
- `deck-go` is treated as the runtime control plane / adapter
- the enterprise platform sits above both

This document answers:

- what the minimum platform subsystems should be
- what each layer should own
- which contracts should exist between the layers
- what should explicitly stay out of the enterprise core

## Executive Summary

If OpenClaw is used only as runtime, the enterprise platform core should not try
to absorb runtime details.

The minimum viable enterprise platform core should own:

- tenant and identity authority
- agent definition registry
- policy and authorization
- runtime fleet registry
- orchestration/workflow control
- audit and observability authority

It should **not** own:

- channel execution
- direct session execution truth
- tool execution truth
- plugin runtime execution

Those remain below, in `OpenClaw runtime`, mediated by `deck-go` or an
equivalent runtime control plane.

## Recommended Layering

## Layer 1 — Enterprise Agent Platform Core

This is the top-level system-of-record for enterprise concerns.

Owns:

- tenant/org/workspace/project hierarchy
- human and machine identity integration
- authorization and policy
- agent definitions and lifecycle states
- runtime fleet inventory
- orchestration and workflow scheduling
- rollout and deployment governance
- audit, analytics, and compliance

## Layer 2 — Runtime Control Plane (`deck-go` or equivalent)

This is the runtime-facing aggregation and control layer.

Owns:

- runtime bootstrap and compatibility
- runtime inventory projection
- runtime-facing REST/SSE/API surfaces for operator UIs
- normalized runtime health/status
- projection/cache/replay logic for frontend and control use
- operator-facing runtime workflows

## Layer 3 — Runtime Leafs (`OpenClaw`)

These are the actual execution runtimes.

Owns:

- live runtime truth
- channel execution
- session truth and effects
- tool execution truth
- local plugin capability execution
- local runtime state

## Layer 4 — Client Surfaces

Examples:

- Deck frontend
- enterprise admin console
- operator dashboards
- automation clients
- external APIs

These should prefer the control plane over direct runtime access.

## Minimum Platform Subsystems

The enterprise platform core should have at least these subsystems.

### 1. Identity and Tenant Authority

Responsibilities:

- tenant/org/project/workspace hierarchy
- users, service accounts, teams, and roles
- SSO / IAM integration
- environment and deployment scopes

Why it is required:

- this is the source of truth for who is allowed to see, operate, and govern runtimes

Must not depend on:

- OpenClaw local config or runtime-local pairing/device state as global truth

### 2. Agent Registry

Responsibilities:

- canonical agent definition
- versioned agent specs
- model/runtime policy references
- deployment targets
- release state (`draft`, `active`, `deprecated`, `rolled-back`)

Why it is required:

- the platform core needs a stable definition of "which agent should exist"
  independent of any one runtime instance

Must not be reduced to:

- copying OpenClaw local agent config files into a database

### 3. Policy and Authorization Engine

Responsibilities:

- RBAC / ABAC
- runtime access policy
- tool/risk policy references
- approval policy references
- environment and tenant policy enforcement

Why it is required:

- enterprise governance should not be delegated to per-runtime operator config alone

Must integrate with:

- identity authority
- agent registry
- fleet registry

### 4. Runtime Fleet Registry

Responsibilities:

- inventory of runtime instances
- runtime version, region, environment, owner, and health metadata
- mapping of agents to runtime cells
- runtime capability summaries
- rollout targets

Why it is required:

- the platform must know which runtimes exist and what they can host

Must not assume:

- "one Gateway per host" is sufficient global inventory truth

### 5. Orchestration / Workflow Control

Responsibilities:

- job orchestration
- control-plane workflows
- asynchronous task coordination
- rollout and migration workflows
- cross-runtime task dispatch

Why it is required:

- enterprise-level coordination should happen above the runtime, not inside it

Must not collapse into:

- direct runtime session management as a substitute for orchestration

### 6. Audit / Observability Authority

Responsibilities:

- normalized audit log
- policy decision traceability
- runtime fleet observability rollup
- governance and compliance reporting
- cross-runtime event lineage

Why it is required:

- platform truth for audit should not depend on leaf-local JSONL transcripts

Must not be confused with:

- runtime-local chat transcripts
- runtime-local log tail surfaces

## Optional But Likely Near-Term Subsystems

These are not the absolute minimum, but are usually the next things needed.

### 7. Plugin / Capability Catalog Governance

Responsibilities:

- catalog of approved plugins/capabilities
- compatibility metadata
- rollout policy
- trusted vs restricted extension classifications

### 8. Secrets / Credential Mediation

Responsibilities:

- platform-side secret references
- credential issuance and rotation policy
- environment/runtime-specific secret distribution rules

### 9. Artifact / Knowledge / Memory Indexing Layer

Responsibilities:

- enterprise-wide artifact references
- shared retrieval indexes
- structured memory/knowledge authority

Important note:

- this should not automatically replace runtime-local memory; it should sit above it

## Contracts Between Layers

## Contract A — Platform Core <-> Runtime Control Plane

This is the most important enterprise contract.

The platform core should send:

- tenant-scoped policy references
- agent deployment intent
- rollout instructions
- access context
- runtime selection intent

The runtime control plane should return:

- runtime inventory and capability summary
- deployment status
- normalized runtime health
- execution metadata and projections
- control-plane events suitable for UIs and automations

This contract should be:

- stable
- typed
- policy-aware
- runtime-agnostic where practical

## Contract B — Runtime Control Plane <-> OpenClaw Runtime

This contract should remain explicitly runtime-facing.

It should carry:

- capability bootstrap
- runtime health/status
- session and inventory projections
- controlled runtime operations
- normalized event subscriptions

It should **not** try to turn OpenClaw into a fake enterprise platform API.

Instead, it should expose:

- runtime truth as runtime truth
- runtime projections as projections

## Contract C — Frontend <-> Runtime Control Plane

This contract should be:

- frontend-friendly
- stable
- projection-oriented
- free from raw runtime quirks where possible

It should avoid:

- leaking OpenClaw internal protocol details directly into the UI unless necessary

## Authority Split

### Platform Core owns

- tenant truth
- org/workspace/project truth
- policy truth
- fleet truth
- deployment truth
- audit truth
- agent definition truth

### Runtime Control Plane owns

- runtime aggregation
- projection/cache
- operator-facing contracts
- compatibility and normalization
- runtime fleet interaction workflows

### OpenClaw Runtime owns

- runtime truth
- session effects
- tool effects
- channel effects
- plugin execution truth
- local runtime state

## Anti-Patterns

Avoid these designs:

### 1. Platform directly driving raw runtime details everywhere

Bad because:

- platform gets coupled to one runtime's wire semantics
- runtime swaps become impossible

### 2. deck-go becoming the enterprise platform by accident

Bad because:

- it overloads a runtime control plane with tenant/platform concerns
- it recreates the same layering mistake one level higher

### 3. OpenClaw local files becoming enterprise truth

Bad because:

- runtime-local state is not suitable as global system-of-record

### 4. Enterprise core re-owning runtime truth

Bad because:

- the runtime is still the only safe source of live execution truth

## Decision Rule

When adding a new responsibility, ask:

1. Is this tenant/policy/fleet/audit/deployment truth?
   - put it in the enterprise core
2. Is this runtime aggregation/projection/operator workflow?
   - put it in deck-go/control plane
3. Is this live runtime execution truth or effect?
   - keep it in OpenClaw runtime

## Minimum Viable Enterprise Core

If you want the smallest serious version, start with these six:

1. Identity + tenant authority
2. Agent registry
3. Policy / authorization engine
4. Runtime fleet registry
5. Orchestration/workflow control
6. Audit / observability authority

That is the smallest architecture that actually behaves like a platform core
instead of just another runtime wrapper.

## Final Judgment

If OpenClaw is positioned as runtime only, the enterprise platform should be
built **above it**, not **inside it**.

The cleanest shape is:

- enterprise platform core for governance and orchestration
- deck-go for runtime control-plane duties
- OpenClaw for runtime execution

That layering gives each system a coherent role and avoids forcing runtime,
control plane, and enterprise platform responsibilities into the same codebase.
