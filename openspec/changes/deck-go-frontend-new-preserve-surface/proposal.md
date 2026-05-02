## Why

`deck-go/frontend-new` now has the desired protocol-v1 workspace skeleton, but its current application shell only exposes the newly migrated `chat` and `agents` panels. This drops the mature `deck-go/frontend` host, navigation, shared runtime UI, non-chat/non-agents business panels, i18n, and tests, so the active frontend loses product coverage while trying to preserve the new architecture.

This change restores the full `frontend` business surface inside `frontend-new` without reverting to the old workspace. `chat` and `agents` remain governed by their new `frontend-new` implementations; the rest of the panels are preserved first, then can be redesigned or contract-tightened module by module.

## What Changes

- Restore the final `deck-go/frontend` deck-ui host surface inside `deck-go/frontend-new`, including shell, nav rail, header, runtime/auth gate, panel host, error boundary, shortcuts, toast container, and active-panel state.
- Preserve all non-chat/non-agents `deck-go/frontend/src/components/panels/*` modules under `frontend-new/src/components/panels/*`, including their panel-local components, CSS, tests, i18n keys, and shared dependencies.
- Keep `frontend-new` as the active engineering workspace and keep the protocol-v1 skeleton intact: design-system tokens/atoms/hooks, `components/panels/<module>/`, handoff protocol, generated contract facades, and `src/api.ts` as the panel API boundary.
- Keep `frontend-new` `chat` and `agents` implementations authoritative. Old `frontend` chat/agents code may be read for edge cases, but MUST NOT overwrite the new migrated modules.
- Restore shared support surfaces required by preserved panels, including `components/shared`, `components/runtime`, `deck-ui` runtime helpers, i18n namespaces, store/lib/hook dependencies, and host verification scripts.
- Add guardrails so future changes cannot silently reduce `frontend-new` back to a two-panel shell or remove preserved panels without an explicit OpenSpec change.
- Clarify that this change is not old `dashboard/` / Next.js visual parity. It preserves the current frozen `deck-go/frontend` product surface in the active `frontend-new` workspace.

## Capabilities

### New Capabilities

- `frontend-new-surface-preservation`: Defines how `frontend-new` preserves the complete frozen `frontend` product surface while retaining protocol-v1 architecture and keeping `chat`/`agents` on their new implementations.

### Modified Capabilities

- `frontend-new-workspace`: Replace the scaffold/two-panel workspace expectations with an active complete-surface workspace that preserves all current `frontend` panels except the explicitly rewritten `chat` and `agents`.
- `panel-registry`: Require the active `frontend-new` registry/host to expose the full preserved panel inventory and route each panel through a data-driven registry without special-casing beyond the intentionally new `chat` and `agents` paths.

## Impact

- Affected active frontend source:
  - `deck-go/frontend-new/src/App.tsx`
  - `deck-go/frontend-new/src/main.tsx`
  - `deck-go/frontend-new/src/app-shell.css`
  - `deck-go/frontend-new/src/deck-ui/*`
  - `deck-go/frontend-new/src/components/panels/**/*`
  - `deck-go/frontend-new/src/components/shared/**/*`
  - `deck-go/frontend-new/src/components/runtime/**/*`
  - `deck-go/frontend-new/src/i18n/*`
  - `deck-go/frontend-new/src/api.ts`
  - `deck-go/frontend-new/src/api-types.ts`
  - `deck-go/frontend-new/src/stores/**/*`
  - `deck-go/frontend-new/src/hooks/**/*`
  - `deck-go/frontend-new/src/lib/**/*`
  - `deck-go/frontend-new/src/theme.css`
  - `deck-go/frontend-new/package.json`
  - `deck-go/frontend-new/scripts/*`
- Reference-only source:
  - `deck-go/frontend/src/deck-ui/*`
  - `deck-go/frontend/src/components/panels/**/*`
  - `deck-go/frontend/src/components/shared/**/*`
  - `deck-go/frontend/src/components/runtime/**/*`
  - `deck-go/frontend/src/i18n/*`
  - `deck-go/frontend/src/theme.css`
  - `deck-go/frontend/scripts/check-deck-ui-host.mjs`
- Contract/documentation impact:
  - `deck-go/contracts/source/deck-ui.contract.json` may need panel-level metadata that labels modules as `new`, `preserved`, or `rewrite-planned`.
  - Generated UI metadata and contract inventory must be regenerated if contract source changes.
  - `deck-go/frontend-new/AGENTS.md` and handoff docs may need a preservation-lane note so future UI work distinguishes preserved modules from new design rewrites.
- Verification impact:
  - `cd deck-go/frontend-new && npm run build`
  - `cd deck-go/frontend-new && npm run test:deck-ui`
  - `cd deck-go && make frontend-build`
  - Host guard equivalent to the old `check-deck-ui-host` must pass for `frontend-new`.
  - A browser smoke should confirm default chat, agents, and representative preserved panels open through the restored shell.
