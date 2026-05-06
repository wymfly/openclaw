## Context

Skills already passed a high-fidelity redesign in the archived `frontend-skills-hifi-contract-redesign` change. The current production module under `deck-go/frontend-new/src/components/panels/skills/` is functional and uses Deck-facing wrappers for installed skills, skill config/update/install actions, ClawHub actions, and the agent skill matrix. A new or refreshed handoff package exists under `deck-go/frontend-handoff/modules/skills/`, and its prototype smoke-passes locally.

That is not enough for the current rollout standard. Agents and channels established a stricter loop: the module must be checked from real Gateway capability through Go BFF routes and frontend behavior, then verified with L1 mock visual evidence and L2 real Gateway API/UI evidence. Skills has more mutation risk than channels because marketplace install/update, skill config writes, and agent assignment writes can affect the user's real OpenClaw state.

## Goals / Non-Goals

**Goals:**

- Use the existing Skills hifi implementation as the product baseline, not as a rewrite mandate.
- Audit Skills real capability across Gateway source/schema, generated Gateway artifacts, `gateway.describe`, Deck endpoint classification, Go BFF routes/adapters, frontend wrappers, and current tests.
- Build a Skills contract-chain matrix from product workflow to wrapper, endpoint/DTO, Go adapter, Gateway method/BFF projection, capability classification, and verification evidence.
- Fix deterministic Skills-scoped drift when it is backed by real evidence and can be corrected without broad architecture work.
- Verify safe reads and non-destructive UI behavior against a real OpenClaw Gateway.
- Keep install/update/config/assignment mutations bounded and handoff-blocked unless disposable or reversible state exists.
- Record implementation notes and verification evidence so later module passes can distinguish hifi/mock evidence from real functional readiness.

**Non-Goals:**

- Do not rewrite the Skills UI solely because a prototype exists; the current production module is already hifi-backed.
- Do not build a skill authoring IDE, dependency solver, credential vault, marketplace trust model, or package manager safety layer.
- Do not run real marketplace installs, skill config writes, or agent assignment writes against the user's normal OpenClaw state without disposable/reversible isolation.
- Do not add new Gateway methods to satisfy prototype-only fields.

## Decisions

### D1: Real verification wraps the existing hifi implementation

The existing `frontend-new` Skills implementation and archived hifi proposal are the starting point. This change audits and verifies them instead of rebuilding from scratch.

Alternative considered: translate the refreshed prototype again. Rejected because the production module already uses module-local components/tests/E2E, and the user's current concern is real Gateway readiness rather than another visual rewrite.

### D2: Contract chain is authority over handoff fixtures

Production behavior follows:

```text
Product workflow
  -> frontend-new API wrapper
  -> Deck-facing endpoint/DTO
  -> Go BFF route/adapter
  -> Gateway method or local BFF behavior
  -> verification evidence
```

Prototype fields for triggers, files, audit, install bins, status labels, or marketplace metadata are implemented only when supported by real DTOs or kept as local mock/handoff notes.

Alternative considered: promote all prototype projections to Deck-facing DTOs. Rejected because Skills payloads include schema-light or provider/marketplace-shaped data, and real ClawHub behavior may vary by network and trust context.

### D3: L2 real verification prioritizes reads and non-destructive UI

Safe L2 scenarios include stack readiness, `gateway.describe`, direct typed `skills.status`, BFF `GET /skills`, `skills.bins` when available, production panel render, filtering/selection, and safe detail/matrix read evidence. Mutation scenarios are separate and require disposable state.

Alternative considered: require install/config/matrix writes before archive. Rejected because the goal loop must continue across modules and must not mutate the user's normal OpenClaw setup without isolation.

### D4: Mock visual evidence remains L1 only

`test/e2e/skills-visual.spec.ts` can prove production UI shape and interaction under deterministic mock data. It cannot prove real ClawHub install safety, real credential persistence, binary availability, or marketplace trust.

Alternative considered: treat mock Gateway handlers as equivalent to real Gateway. Rejected because mock handlers are intentionally deterministic fixtures.

### D5: Code review is mandatory even when real mutations are blocked

The change must include a code-level review over Skills panel components, wrappers, Go routes/adapters, contracts, mocks, E2E, and handoff notes. Real mutation blockers are not code-review findings unless they reveal deterministic implementation defects.

Alternative considered: rely on later cross-module review. Rejected because every module proposal in this rollout needs self-contained completion evidence.

## Risks / Trade-offs

- **Real Gateway may have no skills, no ClawHub network access, or no configured agents** -> Verify shape and empty/degraded rendering instead of asserting fixture rows.
- **Marketplace install/update can affect real files or network state** -> Mark mutation scenarios handoff-blocked unless disposable state exists.
- **Skill config writes can persist credentials or env changes** -> Keep L2 config mutation blocked without reversible fixture state.
- **Agent skill matrix writes can alter the user's main agent** -> Verify read path and UI only unless a disposable agent/config hash is available.
- **`gateway.describe` may omit or partially describe methods** -> Compare describe output with source/generated artifacts and direct typed RPC evidence.
- **Mock visual success can be overclaimed** -> Keep L1 and L2 evidence separate in `verification.yaml` and implementation notes.

## Migration Plan

1. Baseline the refreshed Skills handoff, archived hifi change, production Skills code, wrappers, contracts, backend routes, and tests.
2. Audit real Gateway/BFF capability and build the Skills contract-chain matrix.
3. Fix scoped deterministic drift, if any, before real verification.
4. Run focused frontend/backend tests and the existing mock visual E2E.
5. Add or update a Skills L2 real-stack E2E for safe API/UI scenarios.
6. Apply the real mutation circuit breaker and record blocked scenarios with evidence.
7. Update handoff notes, OpenSpec tasks, verification evidence, and archive once archive-ready.

## Open Questions

- Does real `gateway.describe` advertise every `skills.*` and `deck.agents.skills.*` method, or do Skills have the same describe drift seen in channels?
- Which Skills mutation can be safely verified automatically without altering the user's real skill, ClawHub, or agent configuration?
- Should future work define a disposable real-stack fixture for marketplace/config/agent assignment mutations across all modules?
