## 1. Confirm Evidence Baseline

Current review note (2026-04-27): this umbrella change is not implementation-complete. `deck-shell-i18n-parity` and `deck-chat-visual-parity` are complete on baseline commit `341d965a36`; the remaining page-level child changes stay open until their own old-authority mapping, implementation, i18n, backend-gap, and browser evidence gates pass.

- [ ] 1.1 Capture and store an old-vs-current component inventory for every active panel.
- [ ] 1.2 Capture old-vs-current desktop screenshots for shell, Chat, Agents, Models, Channels, Sessions, Settings, and one representative panel per remaining group.
- [ ] 1.3 Build a visible-copy audit that distinguishes i18n keys, acceptable proper nouns/API identifiers, and hardcoded UI copy.
- [ ] 1.4 Build an interaction audit for nav, theme, locale, keyboard shortcuts, dialogs, tabs, forms, lists, empty/loading/error states, and Chat actions.
- [ ] 1.5 Build a backend parity gap ledger that records old Node+Next service behavior required by each migrated panel and whether the Go backend already exposes it.
- [ ] 1.6 For every Architect/Critic/Verifier review, provide a bounded evidence packet and explicit file/tranche scope. Review agents must return `INSUFFICIENT_EVIDENCE` when the packet is incomplete instead of expanding into broad current-worktree discovery.
- [ ] 1.7 Keep `341d965a36` as the parallel worktree baseline for the remaining Core, Observe, Automate, and Control child changes unless a newer shared-baseline commit is explicitly created first.

## 2. Execute Child Changes In Order

- [x] 2.1 Complete `deck-shell-i18n-parity`.
- [x] 2.2 Complete `deck-chat-visual-parity`.
- [ ] 2.3 Complete `deck-core-panels-visual-parity`.
- [ ] 2.4 Complete `deck-observe-panels-visual-parity`.
- [ ] 2.5 Complete `deck-automate-panels-visual-parity`.
- [ ] 2.6 Complete `deck-control-panels-visual-parity`.

## 3. Final Umbrella Validation

- [ ] 3.1 Run desktop Playwright/browser plugin traversal across all active panels on the Go backend plus managed Gateway stack.
- [ ] 3.2 Verify EN/ZH switching changes panel-local copy on every migrated panel.
- [ ] 3.3 Verify dark/light switching preserves old Deck perceptual hierarchy and contrast.
- [ ] 3.4 Verify no panel claims visual parity without old reference files, current target files, screenshot evidence, and interaction checklist.
- [ ] 3.5 Verify every discovered backend/API/projection gap is fixed, explicitly classified as Gateway-unsupported, or deferred with a blocking reason.
- [ ] 3.6 Document deferred non-parity items, including mobile parity and future redesign.
- [ ] 3.7 Keep Playwright/browser-plugin traversal as the final visual evidence gate after non-browser OpenSpec/test/build evidence is green.

## 4. Closure

- [ ] 4.1 Update Deck parity documentation with the new visual parity definition.
- [ ] 4.2 Mark previous “full visual migration complete” evidence as superseded by this umbrella change.
- [ ] 4.3 Prepare implementation handoff that lists child changes, order, known blockers, and validation commands.
