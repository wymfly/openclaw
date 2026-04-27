## 1. Shell Authority Mapping

- [x] 1.1 Compare `dashboard/src/app/page.tsx` to `deck-go/frontend/src/deck-ui/App.tsx`.
- [x] 1.2 Compare `dashboard/src/components/layout/Shell.tsx` to `deck-go/frontend/src/deck-ui/Shell.tsx`.
- [x] 1.3 Compare `dashboard/src/components/layout/NavRail.tsx` to `deck-go/frontend/src/deck-ui/NavRail.tsx`.
- [x] 1.4 Compare `dashboard/src/components/layout/HeaderBar.tsx` to `deck-go/frontend/src/deck-ui/HeaderBar.tsx`.
- [x] 1.5 Decide and document which old global surfaces are restored now: error boundary, suspense fallback, shortcuts dialog, toast container, theme sync, onboarding.
- [x] 1.6 Record any old Node+Next global service behavior needed by restored shell surfaces and verify whether the Go backend already exposes equivalent auth/bootstrap/notification/status data.

## 2. Registry And Navigation Parity

- [x] 2.1 Align panel ids, groups, icons, label keys, shortcut indexes, eager/lazy metadata, and bottom settings behavior with old Deck.
- [x] 2.2 Restore old Deck active/hover/collapsed sidebar behavior on desktop.
- [x] 2.3 Restore old Deck header gateway status, theme, locale, and panel-title behavior.
- [x] 2.4 Add regression tests for registry-derived nav and shortcut mapping.
- [x] 2.5 Fix or explicitly classify Go backend gaps for global status, notification stream, bootstrap summary, and auth/session projections before hiding related shell controls.

## 3. Shared Primitive Parity

- [x] 3.1 Inventory old shared components in `dashboard/src/components/shared` and `dashboard/src/components/lists`.
- [x] 3.2 Create or migrate Vite equivalents for repeated primitives needed by child panel changes.
- [x] 3.3 Classify one-off primitive duplicates for child panel changes; broad panel rewrites stay out of this shell baseline.

## 4. I18n Audit

- [x] 4.1 Flatten old and new EN/ZH message catalogs and identify key drift.
- [x] 4.2 Scan Vite shell/shared files for hardcoded visible copy; panel-body copy audits remain required in child visual-parity changes.
- [x] 4.3 Add or wire missing translation keys for shell/shared primitives.
- [x] 4.4 Define allowlist rules for proper nouns, API identifiers, code, method names, tokens, and user data.

## 5. Validation

- [x] 5.1 Capture desktop screenshots for old shell and Vite shell in light/dark themes.
  - 2026-04-27 Playwright MCP evidence stored under `.omx/artifacts/deck-shell-i18n-playwright-20260427/`: `old-next-en-light-chat.png`, `old-next-en-dark-chat.png`, `vite-en-light-chat.png`, `vite-en-dark-chat.png`, plus `vite-zh-light-chat.png` and `vite-en-dark-settings-collapsed.png`.
- [x] 5.2 Verify EN/ZH switch changes shell and shared primitive copy.
- [x] 5.3 Run deck-ui host check and targeted shell/registry tests.
- [x] 5.4 Run browser plugin traversal for nav/header/theme/locale interactions.
  - 2026-04-27 Playwright MCP evidence: Go backend reachable on `127.0.0.1:19566`, managed Gateway reached `running/healthy` at `ws://127.0.0.1:18789`, Vite preview reachable on `127.0.0.1:4174`, locale toggle changed shell/nav from ZH to EN, `Alt+2` selected Agents, `Control+,` selected Settings, `Control+/` collapsed the nav rail, `Control+Shift+/` opened an 11-row Keyboard Shortcuts dialog, and theme switching reached `dark` with both current and legacy theme storage keys updated.
- [x] 5.5 Before Playwright, complete the non-browser convergence gate: OpenSpec strict validation, `npm run check:deck-ui-host`, `npm run test:deck-ui`, and `npm run build`.
  - 2026-04-27 evidence: `openspec validate deck-shell-i18n-parity --strict`, `openspec validate deck-full-visual-parity-migration --strict`, `git diff --check`, `npm run check:deck-ui-host`, `npm run test:deck-ui` (83 files / 601 tests), and `npm run build` passed. Build still emits the existing Vite chunk-size warning.
