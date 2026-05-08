---
name: openspec-program-closure
description: Use when an OpenSpec effort spans multiple changes, a design/goal produced a change matrix, external review findings must be reconciled across changes, or Codex needs a program-level closure review before declaring an OpenSpec initiative complete. Complements single-change openspec-closure-workflow.
---

# OpenSpec Program Closure

Use this skill to close an OpenSpec program: a design, goal, module convergence,
or architecture effort that coordinates multiple OpenSpec changes.

This skill does not replace single-change closure. Each child change still needs
normal OpenSpec validation and, when scenario-level evidence is required,
`$openspec-closure-workflow`.

## Decision Tree

- If there is only one active OpenSpec change, use `$openspec-closure-workflow`
  or normal apply/archive verification instead.
- If a design document, `/goal`, user instruction, or implementation history
  names multiple OpenSpec changes, run this program closure before declaring the
  program complete.
- If external review findings cover more than one change, run this skill to
  build a fact baseline and follow-up matrix.
- If the worktree is not clean after a program, include commit readiness in the
  closure result; do not mix unrelated changes into a commit.

## Inputs

Collect as many as are available:

- Program source: design document, goal text, proposal matrix, or user-provided
  list of change names.
- Child OpenSpec changes: active or archived names.
- External reviews: review reports from Claude Code, another agent, or human
  review.
- Verification evidence: child `verification.yaml`, task lists, validation
  output, test/build/contract/E2E commands.

Do not assume external review prose is true. Treat it as input to audit against
code truth.

## Workflow

### 1. Build the Program Matrix

Extract the expected child changes from the source of truth. If the source is
ambiguous, inspect `openspec list --json`, archived change folders, and recent
design documents. Record each change with:

- expected status: proposed / implemented / archived / handoff;
- actual location: `openspec/changes/<name>` or
  `openspec/changes/archive/<date>-<name>`;
- owning design section or goal item.

If the matrix itself is uncertain, state that as a blocker or
`deferred-uncertain` finding instead of guessing completion.

### 2. Check Each Child Change

For every child change:

- Confirm tasks are complete or explicitly handed off.
- Confirm `verification.yaml` exists when the change used scenario-level
  closure or needed archive readiness evidence.
- Confirm the change was validated strictly before archive, or rerun validation
  if it is still active.
- Confirm accepted spec deltas were synced into `openspec/specs/**` and touched
  specs validate strictly.
- Record known unrelated failures and circuit-breaker handoffs exactly.

Use `$openspec-closure-workflow` for a child change if scenario-level closure
state is missing or suspect.

### 3. Run Cross-Change Consistency Review

Look for drift introduced by later changes:

- Reference modules or early implementations not updated after shared helpers
  were introduced.
- Duplicate query keys, DTOs, transports, fixtures, stores, or governance rules.
- Exceptions that should be narrowed, documented, or converted into normal
  module ownership.
- Deferred features that are scattered across multiple files without a unified
  follow-up entry.
- Tests or E2E fixtures that prove module behavior but do not prove the final
  program invariant.

Prefer `rg` and focused file reads. Do not run broad destructive cleanup while
performing closure.

### 4. Reconcile External Reviews

For each external finding, classify it:

- `accepted`: confirmed by code truth and still unfixed.
- `corrected`: confirmed and fixed in this closure pass; include command
  evidence.
- `rejected`: not supported by code truth or the proposed fix is unsafe; include
  rationale.
- `deferred-uncertain`: plausible but needs design decision, contract work, or a
  separate proposal.

Do not blindly adopt external review findings. Fix accepted findings directly
only when the scope is clear and non-destructive.

### 5. Build the Follow-Up Matrix

Group remaining work by decision type:

- `must-fix-before-commit`: correctness, safety, missing evidence, broken
  validation, or archive mismatch.
- `next-openspec`: needs a new proposal or contract/design decision.
- `backlog`: low-risk maintainability, test granularity, or optional developer
  experience work.
- `explicitly-deferred`: intentionally out of scope until a future OpenSpec
  change adds requirements and acceptance criteria.

Each item should include source, reason, proposed owner/scope, and verification
needed.

Persist substantial follow-ups in the tracked OpenSpec follow-up inbox:

`openspec/follow-ups/YYYY-MM-DD-<program>-follow-ups.md`

Use the project template in `openspec/follow-ups/README.md`. Follow-up files are
not active OpenSpec proposals; they are durable prompts for future proposals,
small plans, or backlog decisions. If a closure review contains a follow-up
matrix, either write the matrix into this inbox or link to an existing inbox file
and update statuses there.

### 6. Check Commit Readiness

Inspect `git status --short` and recent commits. Report:

- whether program files are committed;
- whether unrelated files are mixed into the worktree;
- recommended commit groups;
- known verification gaps that should appear in commit trailers.

Do not commit unless the user requested it. Do not stage unrelated files.

### 7. Write the Closure Artifact

Create or update a tracked markdown artifact when the program is substantial:

`docs/superpowers/specs/YYYY-MM-DD-<program>-closure-review.md`

Use this structure:

```markdown
# <Program> Closure Review

## Program Matrix

| Change | Expected | Actual | Verification | Notes |

## Cross-Change Findings

### Accepted / Corrected / Rejected / Deferred-Uncertain

## Follow-Up Matrix

| Priority | Item | Source | Decision Needed | Verification |

## Follow-Up Inbox

Tracked file: `openspec/follow-ups/YYYY-MM-DD-<program>-follow-ups.md`

## Commit Readiness

## Final Verdict
```

For small programs, a concise final report is enough, but still include the same
facts in the answer.

## Completion Criteria

Program closure is complete only when:

- every child change is accounted for;
- no child change has unexplained incomplete tasks or missing validation;
- cross-change drift has been fixed or entered into the follow-up matrix;
- substantial follow-ups are persisted or linked under `openspec/follow-ups/`;
- external review findings have been classified against code truth;
- commit readiness is explicit;
- the final report states whether the program is complete, complete with
  follow-ups, or blocked.
