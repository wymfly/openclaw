## 1. Baseline Evidence And Scope Lock

- [x] 1.1 Read `proposal.md`, `design.md`, and both spec delta files before editing implementation files.
- [x] 1.2 Confirm `deck-go-frontend-agents-rebuild` remains the engineering baseline and record which parts are reused instead of repeated.
- [x] 1.3 Inspect current agents contracts, API facade, store, panel code, tests, and old handoff package; record deterministic drift and uncertain follow-ups.
- [x] 1.4 Capture or record the current agents production UI state for before/after comparison.

## 2. Fresh Agents Handoff Package

- [x] 2.1 Replace the old agents visual target with a fresh Codex-owned `frontend-handoff/modules/agents/prototype.html` based on current contract truth and design-system tokens.
- [x] 2.2 Update `README.md` to identify the new prototype as active, list dependencies, and describe implementation order.
- [x] 2.3 Update `components.md`, `states.md`, and `interactions.md` for list, detail, section navigation, create, delete, loading, empty, error, and keyboard/a11y behavior.
- [x] 2.4 Update `api-usage.md` and `api-discrepancy.md` so mock/prototype assumptions map to current Deck-facing DTOs and known unsupported Gateway features remain explicit.
- [x] 2.5 Update `tokens-proposal.md` or explicitly record that no canonical token/atom change is required.

## 3. Contract-Shaped Mock And API Drift

- [x] 3.1 Add or update reusable agents mock fixtures shaped like current `DeckGo*` DTOs.
- [x] 3.2 Fix only deterministic API facade, type export, or mock drift discovered during implementation; regenerate contracts only if a contract source correction is required.
- [x] 3.3 Keep uncertain Gateway/product-contract gaps as documented follow-ups rather than production assumptions.

## 4. Production Agents UI Translation

- [x] 4.1 Rework the agents list/workbench view to match the fresh handoff density, typography, row structure, toolbar, filters, status vocabulary, loading, empty, and error states.
- [x] 4.2 Rework the selected agent detail workbench, section navigation, overview edit form, and dirty/save/conflict feedback.
- [x] 4.3 Rework skills, subagents, event streams, files, tool policy preview, and system prompt preview sections using typed API wrappers and contract-shaped fallbacks.
- [x] 4.4 Rework create flow and delete confirmation so backend-supported fields and destructive action semantics are clear.
- [x] 4.5 Preserve panel shell/registry behavior, `?dsGallery=1`, shared agents store semantics, and chat isolation.

## 5. Tests And Visual E2E

- [x] 5.1 Update focused unit tests for changed agents state, list/detail rendering, section save conflicts, create, delete, and a11y behavior.
- [x] 5.2 Add mock-backed Playwright visual E2E for agents primary state inside the real `frontend-new` shell and capture screenshot evidence.
- [x] 5.3 Ensure the visual E2E fails on unexpected `console.error` or `pageerror` and reports itself as mock visual coverage, not real Gateway coverage.

## 6. Design-System Feedback

- [x] 6.1 Update agents `implementation-notes.md` with local molecules, pattern candidates, and accepted divergences from the handoff.
- [x] 6.2 Update `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` with agents readiness/completion evidence and links to this change.
- [x] 6.3 Add focused design-system tests or drift checks if any canonical atom/token/pattern changes are introduced.

## 7. Verification, Archive, And Commit

- [x] 7.1 Run `openspec validate frontend-agents-hifi-contract-redesign --strict`.
- [x] 7.2 Run focused frontend tests for agents and any touched design-system atoms/patterns.
- [x] 7.3 Run the agents mock visual E2E.
- [x] 7.4 Run `cd deck-go && make frontend-build`.
- [x] 7.5 Archive the OpenSpec change after all tasks are complete and validate touched archived specs.
- [x] 7.6 Commit this completed proposal as its own local commit with Lore trailers and verification evidence.
