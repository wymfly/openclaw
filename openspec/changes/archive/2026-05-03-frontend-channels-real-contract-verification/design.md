## Context

The agents real-contract pilot is archived and gives this goal loop a usable sample: a module change must start from the high-fidelity handoff, verify real Gateway capability, map the contract chain, implement front/back fixes in scoped slices, run L1 mock visual evidence, attempt L2 real verification with a circuit breaker, and record durable handoff notes.

Channels is the next suitable module. `deck-go/frontend-handoff/modules/channels/` is a v2 multi-file prototype that passes a local browser smoke. It also has a clearer real capability base than many modules: Gateway generated artifacts already include typed `channels.status` and `channels.logout`, Deck-facing DTOs already include channels status/test/throughput responses, Go BFF routes exist for inventory, probe, logout, throughput, and channel patch, and `frontend-new` already has a channels panel plus focused tests.

The prototype still contains assumptions that must be calibrated instead of blindly implemented. In particular, `accountDiagnostics`, `dmPolicy`, and `wecomAccess` are described as BFF projections, while current production code derives diagnostics from provider-shaped account payloads and loads WeCom/routing context through existing config/routing calls. This change must decide from real evidence whether to add/normalize Deck-facing projections or document selector-derived behavior as the current contract.

The newly completed `models` v2 handoff is intentionally deferred from this change. It is a real candidate for a later proposal, but it contains pricing/audit BFF projection assumptions that need their own contract calibration.

## Goals / Non-Goals

**Goals:**

- Use channels as the next module in the agents-style real-contract rollout.
- Treat the channels v2 handoff as the active visual/product target when it matches real contracts.
- Audit Gateway and Deck BFF capability before implementation: source schemas, generated artifacts, `gateway.describe`, exception registry, route/adapters, frontend wrappers, and current tests.
- Build a channels capability matrix mapping product workflows to frontend wrappers, Deck endpoints/DTOs, Go adapters, Gateway methods or local BFF projections, and verification evidence.
- Fix deterministic channels-scoped drift in contracts, Go adapters/routes, API wrappers, production UI, mocks, or tests.
- Keep browser code behind the Deck BFF; no direct Gateway calls from panel components.
- Add or refresh L1 mock visual E2E and focused frontend/backend tests.
- Attempt L2 real-stack API/UI verification for safe channels workflows with bounded retries and documented handoff for environment-sensitive or unsafe mutation blockers.

**Non-Goals:**

- Do not implement `models`, `sessions`, or other modules in this change.
- Do not add broad design-system atoms/patterns unless channels plus existing shipped modules prove a narrow reuse need.
- Do not make unsupported provider/channel behavior appear available.
- Do not require real provider logout, real channel config mutations, or live external-channel connectivity as archive blockers when safe disposable state is unavailable.
- Do not introduce new Gateway methods solely to satisfy prototype mock data.

## Decisions

### D1: Prototype is product input; contract chain is authority

Implementation will start by reading the channels v2 handoff and smoke-testing the prototype, but production behavior is governed by the contract chain:

```text
Product workflow
  -> frontend-new API wrapper
  -> Deck-facing endpoint/DTO
  -> Go BFF route/adapter/selector
  -> Gateway method or local BFF projection
  -> verification evidence
```

Alternative considered: translate the prototype exactly and backfill contracts later. Rejected because it would repeat the drift problem the user is trying to eliminate.

### D2: BFF projections must be explicit or documented as selector-derived

For `accountDiagnostics`, `dmPolicy`, `wecomAccess`, and throughput summaries, this change will choose one of three outcomes:

- add or tighten Deck-facing DTO fields when the projection is deterministic and useful to other clients;
- keep the current frontend selector-derived behavior when the raw contract is intentionally provider-shaped and the derivation is stable;
- document the prototype expectation as a follow-up when neither is safe.

Mock-only fields cannot become production facts without BFF or Gateway evidence.

Alternative considered: always move all prototype projections into the BFF. Rejected because channels account payloads are intentionally provider-shaped and some projections may be UI-specific presentation decisions.

### D3: Real verification splits safe reads from unsafe mutations

L2 real verification will cover safe scenarios first: stack health, `gateway.describe`, `channels.status`, production `/channels`, the production panel opening with real data, selection/tab navigation, throughput empty-state behavior, and no API 4xx/5xx/page errors.

Logout, enable/disable, settings patch, account DM policy, and WeCom access save are mutations. They may be attempted only with disposable or clearly reversible state. If not available, they are handoff-blocked with evidence instead of run against the user's real OpenClaw config.

Alternative considered: require all mutations to pass in L2 before archive. Rejected because the goal loop must continue across modules without being blocked by real external-channel state or credentials.

### D4: Throughput placeholder must be honest

The current Go BFF returns empty throughput buckets. The UI may render a real empty-state, but it must not invent traffic bars or imply real metrics are available. If the implementation discovers a real Gateway-backed throughput source, it can wire it through a scoped contract update; otherwise throughput remains an explicit placeholder/empty state with mock-only visual evidence.

Alternative considered: keep prototype's rich throughput fixture in production mock fallbacks. Rejected because that would blur L1 visual evidence with L2 functional truth.

### D5: Code-level review is mandatory before archive readiness

The change must include a review pass over channels components, API wrappers, Go routes/adapters, contract source/generated drift, mocks, E2E tests, and handoff notes. The review result is recorded as concrete findings or an explicit no-finding statement with residual risks.

Alternative considered: rely on the later Claude Code review. Rejected because each module proposal must be self-contained enough for the `/goal` loop.

### D6: `models` is deferred because its current v2 prototype needs separate contract calibration

The scan found `models` v2 also smoke-passes, but its pricing and audit history projections are not clearly represented in current Deck-facing contracts. This change records that finding and continues with channels rather than forcing models assumptions into an unrelated module.

Alternative considered: implement models first because it is the newest dirty handoff. Rejected because channels has a clearer contract chain and lower sample risk for the next real-contract module.

## Risks / Trade-offs

- **Real Gateway may have no configured channels or disconnected providers** -> Assert shape/capability and empty/degraded rendering instead of hardcoding provider rows.
- **Mutations can alter the user's real OpenClaw config** -> Limit L2 to safe reads unless disposable/reversible state is available; hand off unsafe mutation verification.
- **Provider-shaped account payloads vary** -> Keep normalization defensive and render unknown fields as raw/detail evidence only where useful.
- **BFF projections could broaden the contract** -> Only add deterministic fields that are supported by Gateway/BFF evidence and covered by focused tests.
- **Mock visual success can be mistaken for real readiness** -> Label all mock visual evidence as L1 only and keep L2 status separate.
- **Generated contract docs can drift** -> Update source contracts/generators first, run the matching sync/check target, and keep generated artifacts only when the source change is understood.

## Migration Plan

1. Baseline the channels v2 handoff, current production channels panel, API wrappers, contracts, Go BFF routes/adapters, and real Gateway capability.
2. Build the channels capability matrix and classify each workflow as supported, degraded, unsupported, or environment-dependent.
3. Decide projection ownership for diagnostics, DM policy, WeCom access, and throughput, then implement only deterministic scoped changes.
4. Translate the v2 visual/product target into production `frontend-new` components while preserving BFF boundaries and supported behavior.
5. Update focused frontend/backend tests and L1 mock visual E2E.
6. Attempt L2 real API/UI scenarios with the circuit breaker.
7. Update channels handoff notes, OpenSpec tasks, and verification evidence, then validate and archive when ready.

## Open Questions

- Should account diagnostics become a first-class Deck-facing DTO field, or remain a UI selector over provider-shaped `channelAccounts`?
- Should WeCom access controls be normalized server-side now, or continue to read/write through the existing config/routing helpers?
- Is there a real Gateway throughput source for channels, or should the empty BFF placeholder remain until a later observability change?
- Which channel mutation, if any, can be safely verified automatically against the user's real OpenClaw state?
