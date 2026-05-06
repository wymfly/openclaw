## Context

Agents already has two important baselines:

- `frontend-agents-hifi-contract-redesign` is archived and proves the earlier mock visual workflow: handoff package, production panel translation, mock visual E2E, and design-system feedback.
- `deck-go/frontend-handoff/modules/agents/` now contains a revised v2 interactive React/Babel prototype with contract-shaped data files, section-level interactions, dialogs, and tweak controls. Its README currently marks it as `revised v2 - pending implementation`.

That still leaves a gap. Deck Go is not just a Gateway RPC browser; it is an enterprise control product that replaces CLI workflows with a durable UI. A module is only functionally credible when its product behavior is calibrated against real OpenClaw Gateway capability, expressed through Deck-facing contracts, adapted by Go service code, and exercised through `frontend-new`.

The high-fidelity prototype is therefore product input, not implementation scope by itself. During this change the implementer must explore both sides of the module:

- **Backend/control side**: what Gateway really supports, what Deck Go must normalize or aggregate, what contracts/DTOs/routes are missing or wrong, and what Go adapter behavior must be hardened.
- **Frontend/control side**: how the enterprise UI exposes those real capabilities, what unsupported states are disabled or explained, and how mock visual evidence stays aligned with real contract truth.

The existing L2 real Gateway test is a smoke test. It proves the stack can start, basic Gateway health works, `agents.list` works, chat session creation works, and Chat/Agents do not immediately disconnect. It does not prove the agents product workflow, mutation semantics, contract-chain fidelity, or unsupported-capability handling.

## Goals / Non-Goals

**Goals:**

- Use agents as the pilot for the future module-by-module real-verification workflow.
- Implement the revised agents handoff as the active production UI target if it still matches real capability.
- Audit Gateway capability before product changes: Gateway source/schema, generated artifacts, `gateway.describe`, and documented untyped exceptions.
- Build or update an agents capability matrix mapping product workflows to Deck-facing contracts, Go adapters, frontend API wrappers, and real Gateway methods.
- Fix deterministic contract, Go adapter/route, frontend, or mock drift found during implementation.
- Complete a front/back module development pass: backend adapter correctness, Deck-facing DTO correctness, frontend API correctness, production UI correctness, and real verification evidence.
- Add real-stack agents verification with bounded retries and explicit handoff for environment-sensitive blockers.
- Keep static code review, contract checks, focused tests, and mock visual E2E mandatory even when real verification is blocked.

**Non-Goals:**

- Do not solve all modules in this change.
- Do not redesign chat, routing, subagents, or sessions except where agents links require harmless copy or navigation fixes.
- Do not make unsupported Gateway behavior appear supported in UI.
- Do not add broad new shared design-system atoms/patterns unless agents plus existing modules prove a narrow reuse need.
- Do not require real LLM generation as an archive blocker for this pilot. If a live LLM path is attempted, it is separate evidence and can be handed off when blocked.

## Decisions

### D1: Capability-first verification, not RPC-first wiring

The agents module will be verified from the product workflow backward to Gateway capability. Each important user action gets a row in a capability matrix:

```text
Product workflow
  -> frontend-new API wrapper
  -> Deck-facing endpoint/DTO
  -> Go adapter/normalizer
  -> Gateway method(s)
  -> real-stack evidence or documented blocker
```

Alternative considered: only test that each Gateway RPC returns 200. Rejected because a control product can still be wrong if it exposes the wrong workflow, hides unsupported capability, or normalizes Gateway data incorrectly.

### D1a: The proposal owns backend and frontend completion

This change is not a frontend-only translation task. If exploration shows that agents needs backend route fixes, DTO corrections, generated artifact updates, adapter normalization, or additional focused Go tests to make the product workflow real, those changes are in scope as long as they are agents-scoped and backed by Gateway capability evidence.

Alternative considered: leave all backend gaps as follow-ups and only update the UI. Rejected because that would keep the same false confidence problem: a polished control surface with unverified or incomplete control behavior.

### D2: Three evidence tiers are required

This pilot uses three evidence tiers:

- **Static contract/code evidence**: contract files, generated artifacts, endpoint classification, exception registry, Go adapter tests, frontend API wrapper usage, and no raw Gateway calls from panel components.
- **L1 mock visual evidence**: high-fidelity handoff plus mock Playwright visual coverage for the production shell.
- **L2 real-stack evidence**: real Gateway API/UI smoke for the agents product workflows that are safe to exercise locally.

L2 can be blocked by environment, auth, local OpenClaw state, or live provider availability. Static evidence and L1 evidence remain mandatory.

Alternative considered: make real-stack fully blocking for archive readiness. Rejected because the user needs a goal-loop workflow that can continue across all modules and return to environment-sensitive E2E gaps later.

### D3: Real verification has a bounded circuit breaker

Each real verification scenario gets at most three fresh attempts. Deterministic failures are fixed when the cause is clear. If the same scenario still fails because of unclear real Gateway behavior, local environment, auth, provider availability, or nondeterministic runtime state, the implementation records:

- scenario id
- command or Playwright flow attempted
- attempt count
- observed error/status/log excerpt
- classification: `code-defect`, `contract-gap`, `gateway-gap`, `environment-blocked`, or `needs-human-credentials`
- next recommended action

Then the scenario is marked as handoff-blocked and the module can continue if all mandatory static and mock gates pass.

Alternative considered: skip real verification entirely until all modules are done. Rejected because early agents evidence is needed to validate the workflow and expose contract-chain weaknesses while the sample is still small.

### D4: Contract changes must follow real capability

If the revised prototype expects fields or operations not supported by Gateway or Deck-facing contracts, implementation must choose one of three outcomes:

- adjust the product UI to supported behavior;
- extend Deck-facing contracts and Go adapters when Gateway support is real and deterministic;
- document the gap as an unsupported product follow-up.

Mock data cannot become the authority for new behavior.

Alternative considered: implement the prototype exactly and let backend catch up later. Rejected because that recreates the current drift problem.

### D5: Code-level review is not optional

Even when L2 real-stack verification is circuit-broken, the change must still complete a code-level review pass over:

- panel components and local state;
- `frontend-new/src/api.ts` wrapper usage;
- Go BFF route/adapters touched by agents;
- contract source/generated drift;
- tests and mocks.

The review can be self-performed in this session, but it must produce concrete findings or an explicit no-finding statement with residual risks.

Alternative considered: rely on later Claude Code review. Rejected because the sample workflow must be self-contained enough for `/goal` execution.

### D6: Handoff evidence lives with the module and OpenSpec

Implementation notes in `frontend-handoff/modules/agents/implementation-notes.md` and OpenSpec task evidence must distinguish:

- visual divergences from the v2 prototype;
- deterministic fixes made;
- unsupported product ideas kept out of UI;
- real verification scenarios passed;
- real verification scenarios circuit-broken.

Alternative considered: only summarize in the final chat. Rejected because future module work and cross-review need durable repo evidence.

## Risks / Trade-offs

- **Real Gateway data varies by local OpenClaw state** → Use capability/shape assertions and safe temporary resources; record environment-specific values instead of hardcoding them.
- **Mutating real agents can alter the user's config** → Prefer read-only and reversible flows first; destructive flows require temporary test agents or explicit skip/handoff when safe isolation is unavailable.
- **L2 failures can stall the full module rollout** → Use the bounded circuit breaker while keeping static review and L1 evidence mandatory.
- **Prototype may exceed supported Gateway behavior** → Product-calibrate against real capability and document unsupported ideas instead of shipping fantasy UI.
- **Contract fixes may broaden scope** → Only fix deterministic drift that is necessary for agents; leave wider Gateway schema work as follow-up.
- **Mock visual tests can be mistaken for real readiness** → Name them as L1 mock visual coverage in tasks, evidence, and final reports.

## Migration Plan

1. Baseline current agents v2 handoff, current production agents panel, contracts, Go backend adapters/routes, and real Gateway capability.
2. Build the agents capability matrix and classify supported, degraded, unsupported, and environment-dependent workflows.
3. Implement contract, Go adapter/route, frontend API, and production UI corrections in vertical slices.
4. Add or update focused Go, frontend unit/a11y, and mock visual E2E tests.
5. Run static contract/code checks and perform the mandatory review pass.
6. Run bounded L2 real-stack API/UI attempts for agents; fix deterministic defects; hand off environment-sensitive blockers.
7. Update implementation notes, OpenSpec task states, and verification evidence.

## Open Questions

- Which agents mutations are safe enough for automated real-stack verification without a dedicated disposable OpenClaw state directory?
- Should this pilot later promote a generic `frontend-module-real-verification` spec after two or three modules prove the workflow?
- Should live LLM validation for agents-adjacent chat behavior remain chat-owned, or should agents own a minimal provider/model readiness probe?
