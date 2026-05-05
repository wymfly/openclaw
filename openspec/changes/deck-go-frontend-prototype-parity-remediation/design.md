## Context

deck-go now uses `frontend-new/` as the active React/Vite engineering workspace
and `frontend-handoff/modules/<module>/prototype.html` as the intended
high-fidelity design handoff surface. Prior module changes created many useful
contracts, BFF adapters, frontend panels, mock Gateway fixtures, and visual E2E
specs. The missing piece is strict proof that the production panels actually
match the active prototypes.

The 2026-05-05 audit in
`deck-go/docs/project/frontend-prototype-gap-audit.md` found three important
facts:

- real Gateway captures are often empty or degraded because the test workspace is
  not richly seeded;
- mock visual specs currently capture screenshots but do not compare those
  screenshots with the prototypes;
- many mock-current pages still differ structurally from their prototypes even
  when the mock page has data and the E2E spec passes.

This remediation head is therefore not a normal single-module implementation
change. It is the governing change for a series of child proposals. Each child
proposal remediates one module or one shared evidence tool, and it must satisfy
the stricter parity rules defined here.

## Goals / Non-Goals

**Goals:**

- Establish a reusable module parity workflow that cannot confuse screenshot
  capture with visual alignment.
- Create a module matrix that tracks every active `frontend-new` panel through
  audit, remediation, mock parity, real evidence, accepted exceptions, and
  archive state.
- Build or standardize evidence tooling for prototype screenshots, mock-current
  screenshots, contact sheets, and structured visual verdicts.
- Fix deterministic code, mock fixture, API facade, or contract defects found
  during child proposal work.
- Allow real Gateway E2E circuit breakers only for environmental or upstream
  data-seeding blockers, not for deterministic local defects.
- Use `agents` as the first module sample once the evidence gate is available,
  then continue module-by-module.

**Non-Goals:**

- Do not edit prior archived proposal text to pretend it had stronger evidence.
- Do not implement all modules inside this head change.
- Do not require absolute real Gateway visual parity before every child proposal
  can archive; real evidence can circuit-break with a written handoff if the
  blocker is environmental or seed-related.
- Do not introduce new frontend dependencies unless a later child proposal proves
  a narrow need.
- Do not make old `dashboard/` parity the visual authority for this program. The
  active authority is the current `frontend-handoff` prototype plus explicit
  product decisions grounded in Gateway/deck-go contract truth.

## Decisions

### D1: Create a new head proposal instead of editing archived proposals

Archived proposals are historical evidence. Rewriting them would hide the
process defect and make it harder to reason about which evidence was actually
available at archive time.

Alternative considered: modify every archived module proposal to add stricter
validation language. Rejected because it would create false history and still
would not produce new screenshots, verdicts, or fixes.

### D2: Treat the active prototype as visual truth unless superseded explicitly

Each child proposal must identify the active prototype path before editing UI.
If the prototype conflicts with current Gateway/deck-go contract truth or with a
new product decision, the child must either revise the handoff package first or
record an accepted exception. Silent divergence is not allowed.

Alternative considered: let production UI override the prototype by default
whenever implementation is easier. Rejected because that repeats the current
drift pattern.

### D3: Separate mock functional, mock visual parity, and real Gateway evidence

Mock functional evidence proves the panel opens and interactions work with
contract-shaped data. Mock visual parity proves the production panel matches the
prototype in a controlled state. Real Gateway evidence proves the BFF/Gateway
chain behaves against real state. These are independent evidence layers.

Alternative considered: use the existing `*-visual.spec.ts` screenshots as the
single proof. Rejected because they are not parity assertions.

### D4: Evidence tooling first, module correction second

The first child change should standardize screenshot/contact-sheet/verdict
generation and fix currently failing mock visual specs. Without this, every
module correction would reinvent or weaken the proof format.

Alternative considered: start by manually fixing Agents. Rejected because Agents
would still be judged by an ad hoc standard, making later module work drift
again.

### D5: Child proposals own deterministic fixes

If a child proposal discovers a deterministic code defect, stale fixture,
frontend API mismatch, BFF projection bug, nullability issue, or contract drift,
it must fix that defect before archiving. Only uncertain product questions or
environment-dependent real E2E blockers can be handed off.

Alternative considered: record all defects for a later sweep. Rejected because
the user explicitly wants clear issues fixed during module work when the correct
behavior is known.

### D6: Use accepted exceptions sparingly and structurally

An accepted exception must include the prototype reference, current
implementation reference, reason, owner, and whether it is a Gateway constraint,
product decision, or later redesign deferral. It cannot be a generic note saying
"visual differs."

Alternative considered: leave exceptions in free-form implementation notes only.
Rejected because they cannot reliably block archive or feed later audit.

## Risks / Trade-offs

- **Risk: The remediation program grows large.** -> Use this as a head matrix and
  keep each module in a child proposal with narrow scope and its own archive
  gate.
- **Risk: Prototype quality is uneven.** -> Child proposals must audit prototype
  contract fit before implementation and may revise the handoff package before
  translating it.
- **Risk: Pixel diffs understate layout drift on dark UIs.** -> Use contact
  sheets and structured visual verdicts as the primary evidence; pixel metrics
  are auxiliary only.
- **Risk: Real Gateway seed gaps block progress.** -> Circuit-break real E2E
  after bounded attempts, but only after recording environment, commands,
  failure evidence, and next action.
- **Risk: Fixing deterministic defects widens module scope.** -> Keep fixes in
  the owning child proposal and require focused tests for each fix.

## Migration Plan

1. Create this head proposal with the parity workflow, evidence contract, and
   module matrix requirements.
2. Create and implement a shared evidence-gate child proposal:
   - repair currently failing mock visual specs or update their stale
     assertions/fixtures;
   - add a repeatable prototype-vs-current contact-sheet/verdict workflow;
   - update docs so future module proposals use the stricter gate.
3. Create the `agents` remediation child proposal and implement it as the first
   sample.
4. Remediate remaining modules in prioritized batches:
   - blocking/failing evidence modules: `api-explorer`, `approvals`, `logs`,
     `sessions`;
   - high-value/high-gap modules: `models`, `skills`, `plugins`, `settings`,
     `activity`, `channels`;
   - all remaining modules in the matrix until complete.
5. After every module has child-proposal evidence or accepted exceptions, run the
   completion audit against the matrix and prepare this head proposal for
   archive.
