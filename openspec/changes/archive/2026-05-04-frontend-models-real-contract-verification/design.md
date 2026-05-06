## Context

`deck-go/frontend-handoff/modules/models/` now contains a revised v2 high-fidelity handoff for a model operations workbench. The previous `frontend-models-hifi-contract-redesign` change also rewrote the production `frontend-new` Models panel and added mock visual coverage, but it explicitly excluded real Gateway/LLM E2E.

Current verified contract facts:

- Browser code must call only deck-go backend routes or generated Deck Gateway client wrappers; it must not directly call OpenClaw Gateway.
- Models config save authority is `GET /models/config` and `PATCH /models/config`, carrying raw JSON plus base hash semantics through `fetchModelsConfig` and `saveModelsConfig`.
- Runtime model inventory, auth overview, catalog providers, and auth probe use typed Gateway methods through deck-go wrappers: `models.configured`, `deck.auth.overview`, `models.catalog.providers`, and `deck.auth.probe`.
- Usage aggregation remains BFF-shaped. `/usage/cost` and `/usage/providers` are canonical for Usage; `/models/usage/cost` and `/models/usage/providers` remain Models-compatible aliases.
- The existing mock Gateway already includes model/auth/catalog/probe handlers, and `models-visual.spec.ts` covers the current L1 mock visual workbench.
- The module lacks real-contract spec coverage, a real Gateway E2E file, and implementation notes recording workflow-to-contract classification.

## Goals / Non-Goals

**Goals:**

- Audit Models against the full Gateway/BFF/DTO/frontend/mock/E2E contract chain.
- Fix deterministic Models-scoped drift directly when the source-owned layer and expected behavior are clear.
- Preserve the v2 high-fidelity workbench skeleton while tightening behavior, labels, metadata, tests, and docs around real contract truth.
- Add bounded L2 real-stack evidence for read routes, runtime RPC wrappers, usage routes, probe behavior where safe, and BFF-only browser access.
- Record workflow classifications and residual risks in `frontend-handoff/modules/models/implementation-notes.md`.
- Keep OpenSpec tasks, verification evidence, and archive readiness in sync.

**Non-Goals:**

- No new Gateway endpoints or direct browser-to-Gateway calls.
- No new frontend dependencies or broad design-system atom promotion.
- No forced real LLM calls, provider key changes, or unsafe `openclaw.json` mutations solely to create test data.
- No guarantee that BFF pricing snapshots, PATCH audit history, or force-probe cache controls exist unless verified in code.
- No broad rework of unrelated model usage, agents defaults, or config schema semantics.

## Decisions

1. **Use code truth as the real contract authority and v2 as the product target.**
   The v2 prototype remains the visual/product target, but production behavior must be limited to DTOs, wrappers, Go routes, generated Gateway methods, and documented Deck projections. Prototype-only pricing/audit/force-probe behavior is documented as projected or unsupported unless verified.

2. **Keep raw config as the mutation authority.**
   Provider config edits, catalog apply, fallback chain edits, allowlist edits, and Bedrock discovery edits continue to mutate the raw config draft and submit it through `PATCH /models/config` with the current base hash. A structured UI must not bypass the raw config contract or silently invent a richer patch API.

3. **Classify usage routes explicitly.**
   The frontend currently calls canonical `/usage/*` wrappers for Models usage evidence even though `/models/usage/*` aliases exist. This change should make that route truth explicit in notes/tests/metadata and only change implementation if deterministic drift is found.

4. **Real-stack verification is bounded and operator-safe.**
   L2 should verify route/RPC shapes, UI render, and safe read paths first. Config mutations or probes that could affect real provider state are allowed only when bounded and safe; otherwise they are skipped-safe, degraded, or handoff-blocked after at most three fresh attempts.

5. **Fix deterministic drift during the audit.**
   If the audit finds a clear mismatch in wrappers, endpoint classification, UI metadata, mock data, tests, docs, or frontend behavior, fix the source-owned layer directly and add focused evidence. Ambiguous product gaps become handoff notes rather than speculative implementation.

## Risks / Trade-offs

- **Real Gateway startup or provider auth may be environment-dependent** -> Apply the three-attempt circuit breaker and keep static review, focused tests, mock visual evidence, and build/contract checks mandatory.
- **Models config mutation can affect operator settings** -> Prefer read-only L2 checks; only perform controlled PATCH/probe flows when the test can prove safe inputs and preserve base hash behavior.
- **Prototype overstates BFF projections** -> Mark pricing snapshots, audit logs, and force probe as projected/degraded unless code support is verified.
- **Usage route aliases can cause confusion** -> Record canonical `/usage/*` versus legacy `/models/usage/*` distinction and test the route actually consumed by frontend wrappers.
- **Large existing Models surface makes regressions likely** -> Use focused unit tests, mock visual E2E, real route-shape E2E, `frontend-build`, contract checks when sources change, OpenSpec validation, and `git diff --check`.

## Migration Plan

1. Audit handoff, hifi spec, production panel, wrappers, contracts, backend routes, generated Gateway methods, mock Gateway, and current visual tests.
2. Implement only deterministic Models-scoped fixes and add missing notes/tests/metadata.
3. Run focused frontend tests and L1 mock visual E2E.
4. Run bounded L2 real-stack E2E, applying the circuit breaker when environment or provider state blocks safe verification.
5. Validate OpenSpec, relevant contract checks, frontend build, and whitespace.

## Open Questions

- Whether real Gateway consistently returns runtime models under `payload.models`, `payload.items`, or thinner generated DTO shapes.
- Whether `deck.auth.probe` accepts or should expose force refresh semantics; current wrappers pass only `provider`.
- Whether pricing snapshot and PATCH audit projections should become formal Deck DTOs in a later backend proposal.
- Whether the Models-compatible `/models/usage/*` aliases should be kept indefinitely or deprecated after frontend consumers converge on `/usage/*`.
