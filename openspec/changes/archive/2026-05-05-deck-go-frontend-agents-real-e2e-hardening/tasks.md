## 1. Scope And Truth Sources

- [x] 1.1 Read the head remediation proposal, design, specs, tasks, and matrix after the strengthened real E2E standard was added.
- [x] 1.2 Inspect the agents store, panel, tests, real E2E helper, and current agents real Gateway spec before editing.
- [x] 1.3 Confirm agents can be safely created in isolated real E2E state through the Deck BFF/Gateway-backed route.

## 2. Implementation

- [x] 2.1 Fix agents live-event selection behavior so explicit list state is preserved.
- [x] 2.2 Add focused store regression coverage for live events preserving `selectedAgentId: null`.
- [x] 2.3 Add safe run-scoped agents fixture helpers or inline guarded setup/cleanup for real E2E.
- [x] 2.4 Expand agents real Gateway Playwright coverage for shell navigation, theme/locale variants, interactive child sections, and back-to-list stability.

## 3. Evidence

- [x] 3.1 Run focused agents store tests.
- [x] 3.2 Run `DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/agents-real-gateway.spec.ts --config playwright.config.ts --output .local/agents-real-e2e-hardening --reporter=line`.
- [x] 3.3 Run `make frontend-build`.
- [x] 3.4 Run `openspec validate deck-go-frontend-agents-real-e2e-hardening --strict`.
- [x] 3.5 Run `openspec validate deck-go-frontend-prototype-parity-remediation --strict`.

## 4. Closeout

- [x] 4.1 Update `frontend-prototype-remediation-matrix.md` with the strengthened agents real E2E result and archive path.
- [x] 4.2 Mark head tasks 3.6, 8.1, and 8.2 according to verified evidence.
- [x] 4.3 Archive this child proposal after all tasks are complete.
- [x] 4.4 Commit the scoped hardening work.
