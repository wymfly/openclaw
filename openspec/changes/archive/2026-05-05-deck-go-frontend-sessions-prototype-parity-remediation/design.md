## Context

The current Sessions panel already uses the Deck BFF/API facade for inventory,
preview, detail/history, usage/context, compaction, lineage, transcript cache,
and guarded mutations. The active prototype is also close to the production
shape: three-column session workbench with dense metrics and local evidence
sections.

The remaining problem is not only visual. Real Gateway usage context can return
partially populated nested context-weight objects. The current UI assumes
`contextWeight.tools.entries` and `contextWeight.skills.entries` always exist,
which can throw in real data even when the route itself is healthy.

## Goals / Non-Goals

**Goals:**

- Prove or restore visual alignment with
  `frontend-handoff/modules/sessions/prototype.html`.
- Preserve the existing session contract chain and transcript cache behavior.
- Fix deterministic nullable context-weight crashes.
- Improve mock fixtures only when they represent contract-shaped prototype
  states.
- Create a run-scoped real session fixture through the real Gateway/BFF chain
  when safe, and use it for product-surface validation.
- Keep destructive mutations guarded and safe; cleanup must refuse non-run-id
  targets.

**Non-Goals:**

- Do not add server-side session cursor pagination unless Gateway/deck-go
  contract truth already supports it.
- Do not execute destructive reset/clear/compact/delete against non-run-scoped
  operator sessions.
- Do not claim real LLM response quality; this pass validates the control
  surface and contract chain.
- Do not introduce new frontend dependencies or canonical atoms.

## Decisions

### D1: Fix nullability at the UI boundary unless the contract source is wrong

The UI must tolerate missing nested arrays in optional context-weight sections.
If contract source says those arrays are required but real Gateway data omits
them, this child proposal may also update the source contract and generated
artifacts. Otherwise, the frontend should normalize missing arrays to empty
counts locally.

Alternative considered: hand off the crash as a real-data uncertainty. Rejected
because the access pattern is deterministic and locally reproducible with a
partial context-weight payload.

### D2: Use Gateway RPC/BFF fixture creation for real Sessions data

Real E2E should create a disposable session with a run-id-bearing key or label
through the Deck backend's Gateway RPC route when supported. The test may delete
only keys that include the current run id. If creation or cleanup is blocked by
the environment, the child proposal records the command, status, payload, and
next action.

Alternative considered: use whatever existing real session appears first.
Rejected because it makes the product-surface validation sparse and cannot
prove run-scoped fixture safety.

### D3: Treat prototype parity and real readiness as separate gates

Mock-current parity proves visual alignment in a dense controlled state. Real
Gateway evidence proves product navigation and contract behavior against actual
OpenClaw state. Both are required unless real evidence circuit-breaks for an
environment-only reason.

## Risks / Trade-offs

- **Risk: Real session creation starts an LLM run.** -> Create the fixture
  without an initial message where possible; do not send real chat content in
  this child unless explicitly needed and safe.
- **Risk: Cleanup touches user sessions.** -> Cleanup must check the run id
  before deleting; if the key cannot be proven run-scoped, cleanup is skipped
  and recorded.
- **Risk: Prototype and production use different shell chrome.** -> Record Deck
  shell chrome as an accepted exception if the module panel itself aligns.
- **Risk: Real Gateway returns no usage/context rows for a newly created
  session.** -> Validate nullable rendering and route shape; dense usage visuals
  remain mock-parity evidence.

## Migration Plan

1. Read this child proposal, the head proposal, Sessions handoff files, current
   implementation, tests, contracts, and real E2E helper surfaces.
2. Add focused failing coverage for partial/null context-weight shapes.
3. Fix deterministic Sessions UI/contract/fixture drift.
4. Run focused unit and mock visual evidence.
5. Generate prototype-current contact sheet and structured verdict.
6. Run strengthened real Gateway evidence with run-scoped session fixture data
   or record a bounded circuit-breaker handoff.
7. Update matrix, handoff notes, OpenSpec tasks, and archive readiness.
