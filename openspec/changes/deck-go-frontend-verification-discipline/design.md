## Context

This change is a corrective protocol change after the 2026-05-06 Claude review at `deck-go/frontend-handoff/audit/2026-05-06-codex-refactor-systematic-review.md`.

The review is useful because it identified real closure gaps, but it is not itself source of truth. Codex cross-checked the report against current code and found both valid findings and factual errors. This change therefore treats current repository state and reproducible commands as authority.

Verified facts accepted into this change:

| Area                            | Current verified fact                                                                                                                                                                                                                    | Evidence command or file                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------- |
| Module/panel count              | 26 handoff modules and 26 production panels exist.                                                                                                                                                                                       | `find frontend-handoff/modules ...`, `find frontend-new/src/components/panels ...` |
| README status                   | 0/26 module README status lines match canonical `implemented (sha <commit-sha>)`; 15 are missing and 11 are non-canonical.                                                                                                               | status scan over `frontend-handoff/modules/*/README.md`                            |
| Reverse sign-off                | Only 5/26 module README files contain `Reverse sign-off`; those sections are short, and `activity` still says pending implementation.                                                                                                    | `grep -rl "Reverse sign-off" frontend-handoff/modules/*/README.md`                 |
| Token namespace drift           | 11/26 panels still reference non-`--ds-*` CSS variables; `chat`, `threads`, and `usage` have full legacy token sets.                                                                                                                     | `grep -rEoh "var\\(--...\\)" frontend-new/src/components/panels/*`                 |
| Token mirror drift              | `scripts/check-tokens-drift.sh` exists; before this proposal it failed because scrollbar tokens were not mirrored to `frontend-handoff/design-system/tokens.css`. Codex fixed the mirror in this working tree and the script now passes. | `bash scripts/check-tokens-drift.sh`                                               |
| Panel a11y                      | 36/36 atom tests import the axe helper, but only `agents` has panel-level axe coverage; panel coverage is 1/26.                                                                                                                          | `rg "expectNoAxeViolations" frontend-new/src/...`                                  |
| Prototype parity infrastructure | `scripts/generate-prototype-parity-report.mjs` exists and `.local/*prototype-remediation-parity-report/` directories exist for modules, but `.local` is ignored and not stable evidence. Several verdicts remain `unreviewed`.           | `ls scripts`, `find .local -name "*parity-report*"`, `git check-ignore .local/...` |
| Real evidence notes             | 26/26 module `implementation-notes.md` files contain real or real-contract evidence language, but README files do not consistently link or summarize that evidence.                                                                      | `rg -l "Real Gateway evidence                                                      | real-contract | L2 real" frontend-handoff/modules/\*/implementation-notes.md` |
| Shared list primitives          | `components/shared/lists/*` exists and has tests, but 0 panel files import the primitives.                                                                                                                                               | `rg` over `frontend-new/src/components/panels`                                     |

Corrected findings from the Claude report:

- `scripts/check-tokens-drift.sh` is not missing; it exists and now passes after mirroring scrollbar tokens.
- Prototype parity evidence is not completely absent; the problem is that evidence is partly ignored under `.local`, not uniformly reviewed, and not linked from module README sign-off records.
- Atom a11y is not `0/74`; the current design system has 36 atom files and 36 atom tests importing the axe helper. The real gap is panel-level a11y.
- Single-file panels are a maintainability concern, but current protocol text does not explicitly require a one-to-one multi-file translation from prototype internals. This change does not treat panel splitting as a P0 protocol violation.

## Goals / Non-Goals

**Goals:**

- Create a strict fact-led acceptance gate for frontend remediation work.
- Normalize module README status and reverse sign-off expectations.
- Require tracked evidence manifests for mock functional, mock prototype parity, and real Gateway evidence.
- Require task checkboxes to cite current verification output before they are marked complete.
- Resolve or explicitly classify token drift, panel a11y gaps, and unused shared list primitives before claiming closure.
- Preserve corrected facts in a durable audit artifact so future agents do not re-import known-bad review claims.

**Non-Goals:**

- Redesigning or visually rewriting any panel.
- Splitting single-file panels solely because a report claims this is a hard protocol violation.
- Promoting `AgentChip`, `HashChip`, `ConfirmRow`, `JsonView`, or list primitives into design-system molecules in this change.
- Changing Gateway, Go backend, Deck API DTOs, or OpenClaw source contracts.
- Making `.local` evidence tracked. Instead, tracked manifests SHALL summarize and link/cite local evidence paths and commands.

## Decisions

### Treat current code and commands as the fact authority

Implementation SHALL start by creating a tracked fact baseline under `deck-go/frontend-handoff/audit/`. Every accepted finding needs a command, file path, or deterministic code reference. Every rejected or corrected finding needs a short correction note.

Alternative rejected: use the Claude review as a task list. It contained wrong claims, so directly implementing it would reintroduce fact drift.

### Add a lightweight evidence manifest instead of committing `.local`

Prototype screenshots and E2E artifacts can stay in `.local`, but each module closure must have a tracked manifest entry that names the evidence level, command, artifact path, verdict status, and accepted exceptions. This preserves auditability without committing large generated screenshots.

Alternative rejected: commit all parity screenshots. That would add large binary churn and does not solve verdict quality.

### Keep implementation gates narrow and deterministic

This change should fix deterministic protocol drift first: status lines, reverse sign-off structure, token mirror drift, panel token scan visibility, panel a11y inventory, and unused primitive classification. Broader UI refactors should be separate changes.

Alternative rejected: combine this with panel decomposition and molecule promotion. That would blur fact discipline with design refactoring and repeat the previous closure ambiguity.

### Task completion requires fresh evidence

Tasks in this change SHALL not be checked off based on prior memory, previous goal loops, or historical OpenSpec archives. Each checkbox needs current evidence recorded in `tasks.md` or a linked tracked artifact.

Alternative rejected: mark tasks based on intended state. This is exactly the failure mode the change is meant to prevent.

## Risks / Trade-offs

- Large number of module README edits could be noisy -> use a scripted or tabular update with a reviewable canonical format.
- Some parity evidence may remain `unreviewed` because human visual review is required -> record that status explicitly and do not call it signed off.
- Strict gates can slow future module work -> keep the gate focused on reproducible closure facts, not broad visual redesign.
- Real Gateway evidence can be environment-sensitive -> preserve existing circuit-breaker vocabulary and distinguish deterministic code failures from `handoff-blocked` or `skipped-safe` evidence.

## Migration Plan

1. Create a tracked fact baseline correcting the Claude review and listing accepted findings.
2. Add or update protocol text for status, reverse sign-off, evidence manifests, token/list/a11y gates, and task completion discipline.
3. Add or extend scripts/checks that produce deterministic scan output for the accepted facts.
4. Update module README and implementation-note references only where evidence is current and cited.
5. Run OpenSpec validation and the narrow verification commands named by the tasks.
6. Leave broad UI refactors as follow-up changes with their own fact baselines.

Rollback is documentation and script-level: revert this change's protocol files, audit baseline, and any check scripts. No runtime data migration is required.

## Open Questions

- Whether module README status should point to one broad implementation commit or a module-specific remediation commit when historical work was bundled.
- Whether `unreviewed` parity verdicts are acceptable as an interim state for already-implemented modules, or whether a human visual review must run before each README can say implemented.
