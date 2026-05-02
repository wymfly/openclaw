## Context

Deck Go now has two contract chains at different maturity levels.

The Gateway chain is mostly established: `deck-go/contracts/scripts/protocol-gen-*` generates TypeScript and Go protocol artifacts from the OpenClaw Gateway source authority, and `make gateway-typecheck` currently reports zero frontend violations with eight documented Go exceptions in `deck-go/docs/gateway-untyped-exceptions.md`.

The Deck-facing chain is still partial. `deck-go/contracts/source/deck-api.contract.ts` generates TypeScript and Go DTOs, but `deck-go/frontend/src/api.ts` still contains many hand-written `DeckGo*` types and transport helpers. Backend handlers also still contain dynamic `map[string]any` or `any` boundaries in places where Deck Go owns the BFF shape. This creates a weak bridge between backend reality and frontend design.

The user goal is broader than the current implementation shape: future frontend design should be able to consume the contract chain directly and produce UI that strongly matches runtime behavior. That requires contracts to describe not only raw DTO fields, but also endpoint categories, UI semantics, action safety, state machines, and documented dynamic exceptions.

## Goals / Non-Goals

**Goals:**

- Define the authority order for Gateway source protocol, Go Gateway adapters, Deck Go BFF contracts, generated frontend DTOs, generated backend DTOs, and UI metadata.
- Expand `deck-go/contracts/source/deck-api.contract.ts` into the single source for Deck-facing API/SSE DTOs.
- Keep Gateway protocol types generated from upstream Gateway sources instead of hand-redefining them in Deck Go.
- Classify all Deck Go endpoints so implementation can distinguish Gateway adapters from Deck Go-owned BFF/control-plane APIs and stream/binary/upload routes.
- Generate or validate UI metadata that frontend design can use for panels, forms, tables, filters, actions, status displays, empty states, and safety affordances.
- Add governance gates that prevent new duplicate DTOs, untyped passthrough drift, and stale UI metadata.
- Preserve runtime behavior during migration through additive generated artifacts, adapter shims, and documented exceptions.

**Non-Goals:**

- Do not replace the Gateway protocol with GraphQL, gRPC, or a new external protocol.
- Do not require all upstream schema gaps to be fixed in the first implementation pass; documented exceptions remain allowed with exit criteria.
- Do not rewrite the frontend visual design as part of this proposal.
- Do not remove the Go BFF layer; the browser still speaks to Deck Go, not directly to Gateway.
- Do not archive or rewrite existing active Gateway alignment proposals; this proposal layers the Deck-facing contract and UI metadata work on top.

## Decisions

### D1: Treat the contract chain as layered authorities, not one mega-schema

**Decision**: Use four authority tiers:

1. Gateway source authority: OpenClaw Gateway method/event schemas and registry.
2. Gateway generated artifacts: Deck Go Go/TS typed clients and protocol DTOs.
3. Deck-facing BFF contracts: request/response/SSE DTOs owned by `deck-go/contracts/source/`.
4. UI metadata: generated or validated metadata that references BFF DTOs, fields, actions, and capabilities.

**Alternatives considered**:

- Make Deck Go frontend consume Gateway protocol types directly for everything.
- Hand-write a single combined schema that duplicates upstream Gateway definitions.

**Rationale**:

Direct Gateway types are useful at the adapter boundary, but the UI needs a stable product-level contract. Some screens aggregate, redact, normalize, or enrich Gateway data, so Deck Go needs its own BFF DTOs. Re-defining Gateway schemas by hand would create drift against upstream.

### D2: Endpoint classification is a prerequisite, not cleanup

**Decision**: Every Deck Go endpoint MUST be classified before migration as `gateway-protocol-adapter`, `deck-go-bff`, `stream-binary-upload`, or `documented-exception`.

**Alternatives considered**:

- Migrate all `fetch` calls mechanically.
- Only migrate obviously Gateway-like routes and leave the rest unclassified.

**Rationale**:

`deck-go/frontend/src/api.ts` mixes settings, devices, runtime, channels, approvals, models, skills, sessions, logs, and stream-like endpoints. Without classification, a migration can delete useful BFF behavior or hide Gateway passthroughs behind vague REST wrappers.

### D3: The Deck-facing contract source must grow before bulk frontend cleanup

**Decision**: Strengthen `deck-api.contract.ts` and its generator before moving most `DeckGo*` types out of `api.ts`.

**Alternatives considered**:

- Move types first and fix generator failures incrementally.
- Keep generated Go DTOs optional until the end.

**Rationale**:

The current contract source mostly handles simple exported interfaces. Full module coverage needs richer TypeScript syntax, reusable aliases, enums/unions, records, nested arrays, nullable fields, SSE events, and metadata references. Doing generator work first reduces churn across frontend and backend modules.

### D4: UI metadata is contract data, not frontend decoration

**Decision**: Store UI metadata alongside or adjacent to the Deck-facing contract source, and validate that every metadata reference points to an existing DTO, field, endpoint, or action.

**Alternatives considered**:

- Let each frontend panel infer semantics locally.
- Put UI metadata in design docs only.

**Rationale**:

The target is future frontend design from contract-chain information. That requires stable metadata such as field kind, display label, help text, status color semantics, destructive action hints, mutation safety, empty-state reason, filterability, sorting, and refresh behavior. If that metadata is not validated with DTOs, it will drift.

### D5: Dynamic boundaries require explicit exceptions

**Decision**: Permit dynamic `unknown`, `Record<string, unknown>`, `map[string]any`, and raw Gateway passthroughs only when they are listed in an exception registry with reason, owner, affected endpoint/method, and exit criteria.

**Alternatives considered**:

- Ban dynamic values entirely.
- Allow dynamic values freely during migration.

**Rationale**:

Some Gateway methods still lack upstream schemas, and plugin/config payloads can legitimately be dynamic. A hard ban would force false contracts, but untracked dynamic values recreate the current problem.

### D6: Migration should be domain-staged and verifier-led

**Decision**: Migrate in phases: generator/metadata foundation, endpoint classification, low-risk modules, core Gateway adapter modules, high-risk session/chat/approval streams, then strict gates.

**Alternatives considered**:

- One large PR.
- Frontend-only type cleanup first.

**Rationale**:

This proposal spans generated artifacts, Go handlers, runtime adapters, and many frontend consumers. Staging keeps reviewable diffs and makes it possible to keep `make contracts-check`, `make protocol-check`, `make gateway-typecheck`, frontend typecheck, and backend tests useful at each step.

## Risks / Trade-offs

- **Broad migration surface** -> Keep tasks domain-staged and require module-level verification before enabling stricter global gates.
- **Generator limitations delay DTO migration** -> Treat generator capability as Phase 0; do not start large type moves until generator round-trip tests pass.
- **False precision for dynamic Gateway/plugin/config payloads** -> Use documented exceptions and prefer typed envelopes with `unknown` leaves over pretending unknown structures are stable.
- **UI metadata bloat** -> Start with metadata required by real panels and validators; avoid creating a full design-system DSL in the first pass.
- **Current active proposals overlap Gateway typed coverage** -> This proposal owns end-to-end Deck Go contract and UI metadata; existing Gateway alignment work remains the source for Gateway protocol coverage details.
- **Backend DTO adoption exposes mismatches** -> Allow adapter shims and compatibility tests, but record every mismatch as either a contract fix or an implementation bug.

## Migration Plan

1. Strengthen contract generators and add contract inventory reports.
2. Create endpoint classification and exception registries.
3. Move existing `DeckGo*` DTOs from `frontend/src/api.ts` into `deck-api.contract.ts` domain by domain.
4. Generate and adopt TypeScript DTOs in frontend modules while keeping transport behavior unchanged.
5. Adopt generated Go DTOs in Deck-facing handlers and runtime adapter responses where Deck Go owns the shape.
6. Add UI metadata for migrated domains and validate metadata references.
7. Tighten gates from reporting-only to blocking once coverage is high enough.
8. Remove temporary shims and documented exceptions only when their source schemas or replacement contracts exist.

Rollback is per phase: generated artifacts can be regenerated from the previous contract source, endpoint migrations keep compatibility shims until the corresponding module is verified, and strict gates are enabled only after reports show no unexpected violations.

## Open Questions

- Should UI metadata live in `deck-api.contract.ts` annotations, a sibling `deck-ui.contract.ts`, or per-domain metadata files under `deck-go/contracts/source/`?
- Which fields should be mandatory for first-pass UI metadata: label, field kind, empty state, action safety, capability requirement, or all of them?
- Should dynamic plugin/config payloads receive schema references when plugin manifests provide enough information, or remain `unknown` until a later plugin-schema proposal?
- Should endpoint classification be generated from Go route registration, maintained as a contract source file, or both?
