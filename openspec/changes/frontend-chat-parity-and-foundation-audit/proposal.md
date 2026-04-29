## Why

The previous proposal `frontend-design-system-via-chat` shipped tokens + 36 atoms + 5 hooks and migrated every chat surface to `--ds-*`, but on visual review against the Claude Design bundle the user flagged remaining gaps in three high-traffic surfaces (canvas, artifact panel, composer) plus uncertainty about whether the design system foundation is truly ready to roll out beyond chat. That uncertainty blocks the next-target panels (Settings / Models / Channels / Sessions / Logs) from migrating with confidence. We also have two intentionally deferred a11y items (axe automation + Lighthouse walkthrough) that should not stay open against the previous proposal once it is archived.

This change closes the bundle-parity debt on chat, stress-tests the design system foundation against the cross-module roadmap, and lands the deferred a11y verification — leaving deck-go in a state where any panel team can adopt the design system without re-running the chat-style atom carve-out.

## What Changes

- **Chat surface visual remediation** (3 atoms): port the bundle's `cp-iframe-mock` / `cp-card` / `cp-row` / `cp-actions` decorative shell into `CanvasPanel`, add the `ap-html-stub` fullscreen + `.ap-tab.active` accent variant to `ArtifactPanel`, and ship `composer-icon-btn.active` icon-button row + `cmd-tag` slash-command chip with close button in the composer.
- **Bundle-parity verification protocol**: codify a class-by-class diff procedure against bundle JSX (composer / right-panel / transcript / blocks / app, 2094 LOC) that any future chat-surface change must run before claiming "Claude Design aligned". Output sample: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/chat-parity-gap-report.md`.
- **Cross-module design-system readiness audit**: enumerate every atom + hook against the next 5 target panels (Settings / Models / Channels / Sessions / Logs), classify as `applies` / `extend` / `missing-new-atom`, and surface the worklist required before each panel migration. Output: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`.
- **Atom a11y automation**: introduce `vitest-axe` devDep (~200KB, no runtime impact) and add `expect(container).toHaveNoViolations()` assertions to all P1a + P1b atom tests (36 atoms, ~70 test files), failing CI on regressions.
- **Lighthouse + keyboard walkthrough**: run user-driven manual a11y verification on the chat panel post-remediation (Lighthouse a11y ≥ 95, keyboard-only walk through chat → tool ladder → approval → artifact → canvas) and record the result in this change's tasks.md.
- Visual regression baselines (4 PNGs at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/screenshots/deck-baseline/`) get refreshed after remediation so future P3+ visual diffs anchor on the post-parity state.

## Capabilities

### New Capabilities

- `chat-claude-design-parity`: Defines the bundle-fidelity verification gate every chat-surface change must pass — class-by-class diff against the downloaded Claude Design bundle JSX, screenshot pairs per gap, and a documented divergence justification per missing primitive. Codifies the gate so downstream chat work cannot drift from the bundle without explicit acknowledgment.
- `design-system-cross-module-readiness`: Defines the readiness audit format that gates any non-chat panel migration to the design system — atom × panel matrix with `applies` / `extend` / `missing` status, a list of follow-up atoms required, and a "no atom re-architecture" promise so panel migrations never block on chat-rooted breaking changes.

### Modified Capabilities

(none — this change introduces new verification capabilities and ships visual remediation; it does not change any existing chat behavioral spec or panel parity requirement.)

## Impact

- **Code**: `deck-go/frontend/src/components/panels/chat/{CanvasPanel,ArtifactPanel,MessageInput}.tsx` + their CSS modules; possibly minor JSX in `ApprovalDialog` if visual diff finds extras. Add small new sub-components if bundle structure requires (e.g., `CmdTagChip`, `CpIframeMock`).
- **Atom tests**: 70+ files in `deck-go/frontend/src/design-system/atoms/__tests__/` get one extra axe assertion each.
- **Dependencies**: `vitest-axe` (devDep). Project-wide first new test devDep since the original `frontend-design-system-via-chat` Non-Goal — explicitly opt-in here because the chat migration is no longer the active target.
- **Docs**: 2 new reports under `docs/design-bundles/2026-04-29-claude-design-chat-pilot/` plus refreshed `deck-baseline/*.png` set.
- **No backend / Gateway / contract changes.**
- **No breaking changes to existing chat behavior** — visual-only remediation + verification artifacts.
