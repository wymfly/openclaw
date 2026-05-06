## Context

Deck Go now has several lower-level prerequisites for safe writes:

- route governance records BFF route ownership and evidence;
- config-write safety records base-hash/idempotency/conflict truth for config-like writes;
- control audit history records authenticated `/api` mutation metadata;
- real E2E fixture helpers safely create and clean run-id-scoped budget, alert, and webhook resources.

The remaining gap is that module-level mutation facades still interpret success, deletion, conflict, and retry evidence independently. Some writes return `{ deleted: true }`, some return a resource, some preserve upstream dynamic envelopes, and frontend panels do not have one generated contract that says which request evidence is supported, which writes are fixture-safe, and which mutation classes remain skipped-safe.

This proposal is a platform-control contract, not a Gateway expansion. Gateway truth remains authoritative for Gateway-backed writes, while Deck owns the product-level mutation evidence metadata exposed to `frontend-new`.

## Goals / Non-Goals

**Goals:**

- Inventory current non-read Deck control mutations and classify their evidence semantics.
- Generate Markdown docs and frontend TypeScript metadata from a Deck-owned source contract.
- Add shared frontend helpers that normalize mutation result/error interpretation without hiding existing response DTOs.
- Migrate representative fixture-safe local surfaces: budget rules, alert rules, and webhooks.
- Link mutation rows to audit and fixture evidence so module proposals can depend on this platform contract.
- Keep unsafe fixture classes explicitly deferred/skipped-safe.

**Non-Goals:**

- Do not add new OpenClaw Gateway RPCs, events, or schemas.
- Do not redesign module UI or add new frontend product claims.
- Do not force every mutation response into one payload DTO.
- Do not make unsafe real writes for agents, cron, routing, docs, channel accounts, skills, devices, or memory.
- Do not add durable mutation history, field-level diffs, rollback, or retry queues; those remain module or future platform proposals unless code truth already exists.

## Decisions

### Decision: Use a dedicated mutation evidence contract

Add `deck-go/contracts/source/deck-mutations.contract.json` rather than folding action semantics into route governance or config-write safety. Route governance is route-level, while safe mutation evidence is action-level and must describe request/result/error/audit/fixture semantics for both simple REST routes and multiplexed actions.

Alternative rejected: only use `deck-route-governance.contract.json`. It cannot express action-level evidence for shared routes and would mix ownership with mutation semantics.

### Decision: Preserve response DTOs and normalize evidence beside them

The contract should not rewrite every mutation response into a new universal envelope. Instead, it records each action's existing success indicator, target identity field, request evidence field, conflict behavior, audit coverage, and fixture status. Shared frontend helpers can then produce a small `MutationEvidence` view from existing responses and errors.

Alternative rejected: introduce a single breaking mutation envelope for all writes. That would create broad churn and could hide Gateway-backed response details needed by module panels.

### Decision: Start implementation with proven fixture-safe surfaces

Budget rules, alert rules, and webhooks already have shared real E2E fixture helpers and normal BFF create/update/delete routes. They are the right first consumers for helper tests and facade migration. Other modules stay documented in the contract as deferred/skipped-safe until their module proposals prove disposable cleanup and product semantics.

Alternative rejected: migrate all write paths in this proposal. That would mix platform contract work with module completion and increase the chance of unsafe real writes.

### Decision: Treat audit linkage as process evidence, not durable proof

Mutation rows may mark audit coverage as `process-memory` when the generic audit middleware records the request. This proves the current process can list recent mutation metadata, but it does not imply durable history, rollback, or field-level diffs.

Alternative rejected: require persistent audit for mutation evidence. Durable audit needs retention/deletion/security policy and is outside this child proposal.

### Decision: Conflict support is explicit and conservative

For config-like writes, conflict truth remains governed by `deck-config-write-safety.contract.json`. For local fixture-safe writes, conflict semantics are usually unsupported or validation-error only. The mutation contract records that distinction instead of inventing conflict support.

Alternative rejected: classify every failed mutation as a conflict. That would blur validation, auth, upstream, and stale-hash failures.

## Risks / Trade-offs

- **Risk:** A contract row can imply stronger safety than code provides.  
  **Mitigation:** Require explicit `fixtureSafety`, `auditCoverage`, `idempotency`, and `conflictBehavior` fields and validate referenced frontend/backend evidence paths.

- **Risk:** A shared helper can become too generic and hide module-specific behavior.  
  **Mitigation:** Helpers only normalize evidence metadata; callers keep existing typed responses.

- **Risk:** Real E2E write evidence may be environment-sensitive.  
  **Mitigation:** Use existing fixture-safe resource classes only, and let module proposals use the established circuit-breaker statuses for deeper real evidence.

- **Risk:** Mutation inventory can drift as routes are added.  
  **Mitigation:** Wire generated docs/metadata into `contract-gate` and reference route governance/action IDs where practical.

## Migration Plan

1. Create the source mutation evidence contract and generator/check/test targets.
2. Generate Markdown and TypeScript metadata.
3. Add shared frontend mutation evidence helpers.
4. Migrate representative budget, alerts, and webhooks facades or tests to consume the helper.
5. Run focused contract, frontend, backend where applicable, and build checks.
6. Update the head matrix and verification evidence.
7. Validate and archive the child proposal.

Rollback is straightforward because the contract and helper are additive; existing response DTOs and BFF routes remain unchanged.

## Open Questions

- Agents, cron, routing, docs, skills, device tokens, and memory mutations remain intentionally deferred to module completion proposals.
- Whether later proposals should promote selected mutation evidence into a backend response envelope depends on module-by-module product needs and real E2E findings.
