## 1. Inventory And Authority Map

- [x] 1.1 Capture the frozen `frontend` panel inventory and the current `frontend-new` panel inventory.
- [x] 1.2 Classify `chat` and `agents` as `new` authority modules and all other current frozen `frontend` panels as `preserved`.
- [x] 1.3 Record import-chain requirements for preserved panels across `deck-ui`, `components/shared`, `components/runtime`, `hooks`, `stores`, `lib`, `api`, `api-types`, `i18n`, and `theme.css`.
- [x] 1.4 Identify files in `frontend-new` that must not be overwritten by frozen `frontend` copies, especially `chat`, `agents`, generated contract facades, and design-system files.

## 2. Restore The frontend-new Host Spine

- [x] 2.1 Replace the two-panel `frontend-new/src/App.tsx` shell with the restored full deck-ui host entry point.
- [x] 2.2 Restore `frontend-new/src/deck-ui/App.tsx`, `Shell.tsx`, `HeaderBar.tsx`, `NavRail.tsx`, `PanelHost.tsx`, `ActivePanelHost.tsx`, `PanelErrorBoundary.tsx`, and related host files.
- [x] 2.3 Restore `frontend-new/src/deck-ui/panel-registry.tsx` with the full panel inventory and correct `chat`/`agents` authority.
- [x] 2.4 Restore `frontend-new/src/deck-ui/panel-component-registry.tsx` so every registered preserved panel renders a real component.
- [x] 2.5 Restore `frontend-new/src/deck-ui/ui-store.tsx` with active panel persistence, sidebar/mobile state, runtime summary refresh, auth unlock, and default token behavior.
- [x] 2.6 Restore `frontend-new/src/deck-ui/panel-navigation.ts`, `use-deck-shortcuts.ts`, `use-deck-viewport.ts`, and `KeyboardShortcutsDialog.tsx`.
- [x] 2.7 Update `frontend-new/src/main.tsx` so normal routes boot the restored host while `?dsGallery=1` remains isolated.

## 3. Restore Shared Runtime Dependencies

- [x] 3.1 Restore `frontend-new/src/components/shared/**/*` required by preserved panels.
- [x] 3.2 Restore `frontend-new/src/components/runtime/**/*` required by gateway/runtime-aware preserved panels.
- [x] 3.3 Merge `frontend/src/theme.css` support into `frontend-new/src/theme.css` without breaking design-system token authority.
- [x] 3.4 Restore or reconcile shared hooks from frozen `frontend/src/hooks/**/*`.
- [x] 3.5 Restore or reconcile shared lib utilities from frozen `frontend/src/lib/**/*`.
- [x] 3.6 Restore or reconcile shared stores from frozen `frontend/src/stores/**/*` while preserving new `agents` store additions.
- [x] 3.7 Merge `frontend/src/i18n/en.json` and `frontend/src/i18n/zh.json` into `frontend-new` without overwriting new `agentsPanel` keys.

## 4. Restore Preserved Panels

- [x] 4.1 Restore core preserved panels: `gateway` and `models`; keep `chat` and `agents` new-authority modules unchanged.
- [x] 4.2 Restore observe preserved panels: `usage`, `sessions`, `memory`, `logs`, `activity`, `threads`, and `api-explorer`.
- [x] 4.3 Restore automate preserved panels: `cron`, `webhooks`, `approvals`, and `skills`.
- [x] 4.4 Restore control preserved panels: `budget`, `alerts`, `channels`, `plugins`, `routing`, `subagents`, `identity`, `config`, `nodes`, `docs`, and `settings`.
- [x] 4.5 Restore preserved panel test files and adjust only imports/test setup needed for `frontend-new`.
- [x] 4.6 Remove placeholder-only fallbacks for any panel that now has a preserved implementation.

## 5. Reconcile Contracts And API Facades

- [x] 5.1 Diff frozen `frontend/src/api.ts` against `frontend-new/src/api.ts` and reconcile missing non-chat/non-agents wrappers into `frontend-new`.
- [x] 5.2 Diff frozen `frontend/src/api-types.ts` against `frontend-new/src/api-types.ts` and reconcile missing exported types through contract source or facade exports.
- [x] 5.3 Update contract source and regenerate artifacts if a required DTO or UI metadata field is missing; do not hand-edit generated files.
- [x] 5.4 Add panel authority metadata (`new`, `preserved`, or `rewrite-planned`) to UI contract metadata or frontend-new docs.
- [x] 5.5 Run the matching contract sync/check target if contract source changes.

## 6. Guardrails And Tests

- [x] 6.1 Port or recreate the old `check-deck-ui-host` guard for `frontend-new`.
- [x] 6.2 Make the host guard verify normal boot path, full registry inventory, component registration coverage, no chat/agents overwrite, and no placeholder-only preserved panels.
- [x] 6.3 Add or port host tests for panel routing, registry grouping, shortcut mapping, active panel persistence, and auth/default token behavior.
- [x] 6.4 Add representative preserved panel smoke tests across core, observe, automate, and control groups.
- [x] 6.5 Ensure `frontend-new/package.json` runs the host guard as part of build or another explicit verification script.

## 7. Documentation And Handoff Notes

- [x] 7.1 Update `frontend-new/AGENTS.md` to describe the preservation lane and module authority statuses.
- [x] 7.2 Update `frontend-handoff/modules/README.md` or related docs so preserved modules are not treated as missing design handoff work.
- [x] 7.3 Document that future redesign changes must start from preserved behavior and explicitly change it when needed.

## 8. Verification

- [x] 8.1 Run `cd deck-go/frontend-new && npm run build`.
- [x] 8.2 Run `cd deck-go/frontend-new && npm run test:deck-ui`.
- [x] 8.3 Run `cd deck-go && make frontend-build`.
- [x] 8.4 Run the new `frontend-new` host guard directly if it is not already part of the prior commands.
- [x] 8.5 Start or reuse the local stack and smoke-test default chat, `?panel=agents`, and representative preserved panels from core, observe, automate, and control groups.
- [x] 8.6 Run `openspec validate deck-go-frontend-new-preserve-surface --strict`.
