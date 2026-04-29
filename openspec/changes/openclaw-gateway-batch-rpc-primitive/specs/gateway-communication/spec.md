## ADDED Requirements

### Requirement: `gateway.batch` is part of the public RPC surface

The gateway SHALL expose `gateway.batch` as a typed public RPC method that lets callers compose multiple sub-calls in one round-trip while preserving per-call validation, scope, role, and rate-limit semantics. The method SHALL appear in `gateway-protocol.generated.ts` and `gateway-client.generated.ts`, and the deck-go generated typed client SHALL surface a corresponding `Batch` method.

#### Scenario: Typed clients see gateway.batch in their generated method maps

- **WHEN** `pnpm protocol:gen:ts` is executed after this change
- **THEN** `dashboard/src/types/gateway-protocol.generated.ts` MUST contain `GatewayBatchParams`, `GatewayBatchResult`, and an entry for `"gateway.batch"` in `GatewayMethodMap`
- **AND** `deck-go/backend/internal/gateway/generated/methods.go` MUST contain a `Batch` method on the typed client

#### Scenario: gateway.describe surfaces the batch method

- **WHEN** a client calls `gateway.describe` after this change
- **THEN** the result MUST list `gateway.batch` as a registered method with `forkClass: "C5"` and the params/result schema reachable via the registry

### Requirement: Pre/post `gateway.describe` diff allow-list permits `gateway.batch`

The pre/post-migration `gateway.describe` diff allow-list (introduced by the parent proposal `openclaw-gateway-bff-architecture-refactor`) SHALL include the addition of the `gateway.batch` method as one of its documented allowed differences, so that landing this proposal does not require ad-hoc baseline regeneration.

#### Scenario: Allow-list is extended in the same change set

- **WHEN** this proposal lands
- **THEN** `scripts/diff-describe-baseline.ts` MUST be updated in the same change set to add `gateway.batch` to its allow-list, so the baseline diff continues to exit zero
