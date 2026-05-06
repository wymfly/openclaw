# Codex Cross-Review Fact Baseline

| Field          | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Date           | 2026-05-06                                                                                                 |
| Change         | `deck-go-frontend-verification-discipline`                                                                 |
| Source review  | `deck-go/frontend-handoff/audit/2026-05-06-codex-refactor-systematic-review.md`                            |
| Authority rule | Current repository files and rerunnable commands are authoritative; the Claude review is input, not truth. |

## Inventory Snapshot

Command:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

Initial output before remediation:

| Category                          | Count / Result                               |
| --------------------------------- | -------------------------------------------- |
| Handoff modules                   | 26                                           |
| Production panels                 | 26                                           |
| README status compliance          | 0/26 pass                                    |
| Reverse sign-off compliance       | 0/26 pass                                    |
| Token mirror drift                | pass                                         |
| Panel token drift                 | 11 unclassified modules                      |
| Atom a11y                         | 36/36 atom tests import axe helper           |
| Panel a11y                        | 1/26 classified                              |
| Shared list primitive panel usage | 0 panel usages, no classification            |
| Evidence manifest                 | 26/26 modules, 21 unreviewed parity verdicts |

The inventory command intentionally exited non-zero at this stage because README status, reverse sign-off, token exceptions, panel a11y classifications, and shared-list classification were not yet remediated.

## Accepted

### 1. Module and panel surface count

Fact: `frontend-handoff/modules/` and `frontend-new/src/components/panels/` each contain 26 module directories.

Evidence:

```bash
cd deck-go
find frontend-handoff/modules -mindepth 1 -maxdepth 1 -type d | wc -l
find frontend-new/src/components/panels -mindepth 1 -maxdepth 1 -type d | wc -l
```

### 2. README status drift

Fact: Initial status scan found 0/26 module README files compliant with `**Status**: implemented (sha <40-hex-commit-sha>)`.

Evidence:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

Initial output: `README status: 0/26 pass`.

### 3. Reverse sign-off drift

Fact: Initial reverse sign-off scan found 0/26 module README files with the structured fields required by this change.

Evidence:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

Initial output: `reverse sign-off: 0/26 pass`.

### 4. Panel token namespace drift

Fact: 11 panels initially referenced non-`--ds-*` CSS variables. The affected modules were `alerts`, `approvals`, `budget`, `chat`, `config`, `docs`, `identity`, `nodes`, `plugins`, `threads`, and `usage`.

Evidence:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs --json
```

Relevant field: `panelTokens.failures`.

### 5. Token mirror drift check exists and is required

Fact: `scripts/check-tokens-drift.sh` exists and is the token mirror authority. It now passes after mirroring scrollbar tokens into `frontend-handoff/design-system/tokens.css`.

Evidence:

```bash
cd deck-go && bash scripts/check-tokens-drift.sh
```

Passing output:

```text
check-tokens-drift: ok (token bodies identical from :root onwards)
```

### 6. Panel a11y gap is separate from atom a11y

Fact: 36/36 atom tests import `expectNoAxeViolations`; panel-level a11y coverage was initially classified for only `agents`.

Evidence:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

Initial output:

```text
atom a11y: 36/36 atom tests import axe helper
panel a11y: 1/26 classified
```

### 7. Prototype parity evidence exists but is not durable enough by itself

Fact: `.local/*prototype-remediation-parity-report/` contains parity artifacts for modules, but `.local` is ignored and cannot be the only closure record. The tracked manifest currently records 26 modules and preserves 21 `unreviewed` parity verdicts.

Evidence:

```bash
cd deck-go
node scripts/generate-frontend-evidence-manifest.mjs
node scripts/frontend-verification-inventory.mjs
git check-ignore .local/agents-prototype-remediation-parity-report/verdict.json
```

Tracked manifest: `frontend-handoff/audit/module-evidence-manifest.json`.

### 8. Real evidence notes exist for all modules but need manifest linkage

Fact: 26/26 `implementation-notes.md` files contain real or real-contract evidence language, but README files did not consistently summarize/link that evidence.

Evidence:

```bash
cd deck-go
rg -l "Real Gateway evidence|real[- ]contract|L2 real|Real E2E|strengthened real" frontend-handoff/modules/*/implementation-notes.md | wc -l
```

### 9. Shared list primitives are unused by panels

Fact: `frontend-new/src/components/shared/lists/*` exists and has tests, but no panel imports its exported primitives.

Evidence:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

Initial output: `shared lists: usage=0, classification=none`.

## Corrected

### 1. `scripts/check-tokens-drift.sh` is not missing

Claude report claim: the token drift script does not exist.

Correction: the script exists at `deck-go/scripts/check-tokens-drift.sh`. The real issue was that it was not clean before the scrollbar token mirror fix.

Evidence:

```bash
cd deck-go
ls -l scripts/check-tokens-drift.sh
bash scripts/check-tokens-drift.sh
```

### 2. Prototype parity evidence is not completely absent

Claude report claim: prototype parity evidence is 0/26.

Correction: prototype parity infrastructure and `.local` reports exist, but ignored artifacts and `unreviewed` verdicts are insufficient for durable sign-off. This change tracks those facts in `frontend-handoff/audit/module-evidence-manifest.json`.

Evidence:

```bash
cd deck-go
ls scripts/generate-prototype-parity-report.mjs
find .local -maxdepth 1 -type d -name "*prototype-remediation-parity-report" | wc -l
node scripts/frontend-verification-inventory.mjs
```

### 3. Atom a11y is not 0/74

Claude report claim: atom a11y coverage is probably 0/74.

Correction: current atom count is 36, and all 36 atom test files import the shared axe helper. The real gap is panel-level a11y classification/coverage.

Evidence:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

### 4. Single-file panels are not a hard protocol violation by current text

Claude report claim: single-file panels violate the Translation rules.

Correction: current protocol says prototype JSX translates into `.tsx` files and warns not to drop design decisions; it does not explicitly require one production file per prototype molecule. Large single-file panels are a maintainability follow-up, not a closure blocker in this change.

Evidence:

```bash
cd deck-go
rg -n "Translation rules|multi|单文件|禁止" frontend-handoff/CLAUDE.md frontend-new/CLAUDE.md
```

## Rejected

### 1. Treating the Claude report as an implementation task list

Reason: the report contains factual errors. Tasks must derive from this fact baseline and the OpenSpec specs, not directly from review prose.

### 2. Committing all `.local` screenshots as proof

Reason: `.local` contains large generated artifacts and is ignored intentionally. The durable proof is a tracked manifest plus rerunnable commands, not binary artifact churn.

## Deferred-Uncertain

### 1. Whether every `unreviewed` parity verdict must become human-accepted before README status can be implemented

Current decision: preserve `unreviewed` in the manifest and avoid claiming high-fidelity visual acceptance. Product/human visual review can later upgrade those modules.

### 2. Whether single-file panels should be decomposed

Current decision: classify as maintainability follow-up unless a future proposal defines module-specific decomposition boundaries and verification.

## Final Verification Slot

Final inventory command:

```bash
cd deck-go && node scripts/frontend-verification-inventory.mjs
```

Final output:

```text
# deck-go frontend verification inventory

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

Other verification:

```bash
cd deck-go && bash scripts/check-tokens-drift.sh
cd deck-go && node --check scripts/frontend-verification-inventory.mjs
cd deck-go && node --check scripts/generate-frontend-evidence-manifest.mjs
cd deck-go && make frontend-build
openspec validate deck-go-frontend-verification-discipline --strict
```

Notes:

- `make frontend-build` initially failed on `frontend-new/src/components/panels/sessions/SessionUsageDetails.tsx` because `reduce` inferred `unknown`; the implementation added an explicit `reduce<number>` annotation and the build passed.
- 21 prototype parity verdicts remain `unreviewed` by design. They are tracked and not upgraded to visual acceptance.
