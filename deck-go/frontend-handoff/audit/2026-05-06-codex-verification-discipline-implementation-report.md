# Codex Implementation Report: Frontend Verification Discipline

| Field           | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| Date            | 2026-05-06                                                    |
| OpenSpec change | `deck-go-frontend-verification-discipline`                    |
| Scope           | Fact-led remediation of the 2026-05-06 Claude frontend review |
| Commit status   | Not committed at report time                                  |
| Apply status    | 20/20 tasks complete; ready to archive after review           |

## Executive Summary

Codex implemented a verification-discipline change rather than blindly applying the Claude review. The implementation records which review claims were accepted, corrected, rejected, or deferred; adds deterministic inventory tooling; creates tracked evidence manifests for the 26 modules; updates protocol docs; and normalizes every module README to a machine-checkable `Status` plus structured `Reverse sign-off`.

This change intentionally does not redesign panels, split single-file panels, or promote design-system molecules. Those are separate follow-up decisions.

## Key Corrections To Claude Review

| Claude review claim                                      | Codex correction                                                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/check-tokens-drift.sh` is missing               | Incorrect. The script exists and now passes after token mirror sync.                                                                                             |
| Prototype parity evidence is 0/26                        | Overstated. `.local/*prototype-remediation-parity-report/` exists, but `.local` is ignored and many verdicts remain `unreviewed`; tracked manifest is now added. |
| Atom a11y is likely 0/74                                 | Incorrect. Current design-system atom count is 36, and all 36 atom tests import the axe helper. The real gap is panel-level a11y.                                |
| Single-file panels are hard Translation-rules violations | Not proven by current protocol text. Classified as maintainability follow-up unless a future proposal makes decomposition mandatory.                             |

## Files Added

- `deck-go/frontend-handoff/audit/2026-05-06-codex-cross-review-fact-baseline.md`
- `deck-go/frontend-handoff/audit/2026-05-06-codex-verification-discipline-implementation-report.md`
- `deck-go/frontend-handoff/audit/frontend-verification-classifications.json`
- `deck-go/frontend-handoff/audit/module-evidence-manifest.json`
- `deck-go/scripts/frontend-verification-inventory.mjs`
- `deck-go/scripts/generate-frontend-evidence-manifest.mjs`
- `openspec/changes/deck-go-frontend-verification-discipline/**`

## Files Modified

- `deck-go/frontend-handoff/CLAUDE.md`
- `deck-go/frontend-new/CLAUDE.md`
- `deck-go/frontend-handoff/design-system/tokens.css`
- `deck-go/frontend-handoff/modules/*/README.md`
- `deck-go/frontend-new/src/components/panels/sessions/SessionUsageDetails.tsx`
- `deck-go/frontend-handoff/audit/2026-05-06-codex-refactor-systematic-review.md`

## What Changed

### Fact Baseline

Created a tracked fact baseline with:

- `accepted`
- `corrected`
- `rejected`
- `deferred-uncertain`

Accepted/corrected items include rerunnable commands or specific file references. This is intended to prevent future agents from treating review prose as source of truth.

### Inventory Tool

Added:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

The tool checks:

- handoff module count
- production panel count
- README status format
- structured reverse sign-off completeness
- token mirror drift
- panel non-`--ds-*` token drift and exceptions
- atom a11y vs panel a11y
- shared-list primitive usage/classification
- tracked evidence manifest coverage

Final inventory output:

```text
modules: 26
panels: 26
README status: 26/26 pass
reverse sign-off: 26/26 pass
token mirror: pass (bash scripts/check-tokens-drift.sh)
panel token drift: 0 unclassified modules
atom a11y: 36/36 atom tests import axe helper
panel a11y: 26/26 classified
shared lists: usage=0, classification=keep-experimental-follow-up
evidence manifest: 26/26 modules, unreviewed parity=21

No blockers.
```

### Evidence Manifest

Added `module-evidence-manifest.json` for all 26 modules. It records three evidence levels:

- `mock-functional`
- `mock-prototype-parity`
- `real-gateway`

Important: 21 prototype parity verdicts remain `unreviewed`. The manifest preserves that status and does not upgrade them to visual sign-off.

### Protocol Updates

Updated both protocol files to require:

- tracked fact baseline for review-driven remediation
- fresh evidence before OpenSpec task checkboxes are marked complete
- canonical implemented README status: `**Status**: implemented (sha <40-hex-commit-sha>)`
- structured reverse sign-off template
- tracked manifest for `.local` evidence
- single-file panel decomposition classified as maintainability follow-up unless explicitly required by a proposal

### README Normalization

All 26 module READMEs now have:

- canonical implemented status line
- structured `## Reverse sign-off` table
- manifest links for mock functional, mock prototype parity, and real Gateway evidence

### Token Mirror Fix

Synced scrollbar token additions into `frontend-handoff/design-system/tokens.css` so:

```bash
cd deck-go && bash scripts/check-tokens-drift.sh
```

passes.

### Build Fix

`make frontend-build` initially failed on `SessionUsageDetails.tsx` because `reduce` inferred `unknown`. Codex applied a minimal `reduce<number>` annotation. Build then passed.

## Verification

Passed:

```bash
cd deck-go && bash scripts/check-tokens-drift.sh
cd deck-go && node scripts/frontend-verification-inventory.mjs
cd deck-go && node --check scripts/frontend-verification-inventory.mjs
cd deck-go && node --check scripts/generate-frontend-evidence-manifest.mjs
cd deck-go && make frontend-build
openspec validate deck-go-frontend-verification-discipline --strict
openspec instructions apply --change deck-go-frontend-verification-discipline --json
```

OpenSpec apply result: 20/20 tasks complete.

## Known Residuals

- 21 modules still have `mock-prototype-parity` verdict `unreviewed`; this is tracked, not hidden.
- Panel-level a11y is classified for all modules, but most modules still need actual panel axe tests in a future hardening pass.
- `chat`, `threads`, and `usage` still have legacy token namespaces; they are tracked as temporary exceptions, not silently accepted as clean.
- `frontend-new/src/components/shared/lists/*` remains unused by panels and is classified as `keep-experimental-follow-up`.
- Single-file panels remain a maintainability concern, not a blocker in this change.

## Review Focus For Claude Code

1. Verify whether the fact baseline accurately corrects the original review.
2. Check whether `frontend-verification-inventory.mjs` enforces the intended blockers without hiding residuals.
3. Review the structured reverse sign-off table inserted into 26 module READMEs.
4. Confirm the temporary token/a11y/list classifications are acceptable for this discipline-only change.
5. Confirm the build fix in `SessionUsageDetails.tsx` is minimal and behavior-preserving.
