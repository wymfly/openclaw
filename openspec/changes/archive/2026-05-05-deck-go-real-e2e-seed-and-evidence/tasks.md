## 1. Explore Existing Seed Path

- [x] 1.1 Re-read the head proposal, verification evidence, existing real E2E helpers, and real Gateway smoke spec to confirm current seed behavior and prior failure cause.
- [x] 1.2 Confirm that no existing child proposal/archive already owns `deck-go-real-e2e-seed-and-evidence`.

## 2. Repeatable Seed Evidence Implementation

- [x] 2.1 Add persistent redacted evidence output support for `DECK_GO_REAL_E2E_EVIDENCE_DIR` without changing the default self-cleaning temp-root behavior.
- [x] 2.2 Add a focused deck-go command/Make target for the isolated `cpa` + `main` seed smoke.
- [x] 2.3 Add or update focused regression coverage proving persistent evidence is redacted and named by the current run id.

## 3. Real Seed Verification

- [x] 3.1 Run the focused real seed command with `DECK_GO_REAL_GATEWAY_E2E=1` and a temporary persistent evidence directory.
- [x] 3.2 If the seed fails after bounded attempts, investigate deterministic code/config causes first; only record handoff-blocked evidence when the blocker is environment, credential, network, or upstream-service dependent.

## 4. Matrix And OpenSpec Closure

- [x] 4.1 Update the head proposal matrix JSON and generated Markdown so `deck-go-real-e2e-seed-and-evidence` reflects the completed/archived lifecycle.
- [x] 4.2 Run `openspec validate --type change deck-go-real-e2e-seed-and-evidence --strict`.
- [x] 4.3 Run the relevant focused deck-go tests/checks for touched surfaces.
- [x] 4.4 Run `git diff --check`.
- [x] 4.5 Archive this child change after tasks and validation pass, syncing the spec delta into top-level specs as needed.
