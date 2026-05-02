## Context

`deck-go/frontend-new` is now the active frontend workspace. It owns the protocol-v1 design system, generated contract facades, `components/panels/<module>/` layout, and the design-to-code handoff protocol. The current `frontend-new` application shell, however, only switches between `chat` and `agents`.

The frozen `deck-go/frontend` workspace still contains the mature product surface: final deck-ui host, panel registry, runtime/auth shell, navigation, shared/runtime components, i18n, tests, and all non-chat/non-agents panels. The prior `frontend-new` route treated those panels as future protocol rewrites, which creates a product regression: the active frontend loses the previous management and operations coverage while preserving only the new skeleton.

This change restores the frozen `frontend` surface into `frontend-new` while keeping `frontend-new` as the architectural authority. It is a preservation migration, not a redesign pass and not a `dashboard/` visual parity program.

## Goals / Non-Goals

**Goals:**

- Make `frontend-new` expose the complete current deck-go product surface from the frozen `frontend` workspace.
- Preserve the `frontend-new` protocol-v1 skeleton, design system, generated contract facades, and module layout.
- Keep `frontend-new` `chat` and `agents` implementations authoritative.
- Move non-chat/non-agents panels in a behavior-preserving lane before redesigning or tightening them further.
- Restore host-level product capabilities: panel registry, shell/nav/header, runtime/auth gate, keyboard shortcuts, toast/error boundary, URL/localStorage panel state, and runtime summary refresh.
- Restore shared component/runtime dependencies needed by preserved panels.
- Add verification and guardrails that detect a regression back to a two-panel shell.

**Non-Goals:**

- Do not migrate from the legacy `dashboard/` Next.js client in this change.
- Do not redesign every preserved module through `frontend-handoff` before restoring it.
- Do not replace the new `chat` or `agents` modules with old `frontend` implementations.
- Do not introduce new frontend dependencies solely for routing, state, or preserved panel support.
- Do not manually edit generated contract artifacts to force a panel to compile.

## Decisions

### Decision 1: Restore the final deck-ui host, not the temporary two-panel shell

The active app should boot through a full `deck-ui` host in `frontend-new`, modeled on the final host in frozen `frontend`. The two-panel `App.tsx` shell was useful for the first `chat`/`agents` migration slice, but it is no longer the correct product host.

Rejected alternative: keep the two-panel shell and add panels one at a time through new redesign changes. That would keep the active product incomplete for too long and would discard tested old work before a replacement exists.

### Decision 2: Use a two-lane panel authority model

Panels are classified by implementation authority:

- `new`: `chat` and `agents`, governed by their `frontend-new` OpenSpec changes and current source.
- `preserved`: all other current frozen `frontend` panels, copied/adapted into `frontend-new` with behavior preserved.
- `rewrite-planned`: future state for a preserved panel only after a separate proposal chooses to redesign it.

This allows product coverage to be restored immediately while preserving the ability to redesign later with stronger contracts and design handoff packages.

Rejected alternative: mark every legacy panel as `ready-for-implementation` and wait for handoff packages. That makes restoration dependent on design churn instead of on code truth.

### Decision 3: Preserve dependencies as chains, not isolated panel directories

Non-chat/non-agents panels depend on `deck-ui` helpers, shared shell components, runtime components, hooks, stores, lib utilities, i18n namespaces, and theme CSS. The migration must follow import chains and tests rather than copying panel folders alone.

Rejected alternative: copy only `components/panels/*` and stub missing imports. Stubs would hide regressions and undermine the contract-first goal.

### Decision 4: Keep API source truth in `frontend-new/src/api.ts` and contracts

Preserved panels should continue calling the `frontend-new` API facade. If old panel code requires a DTO or wrapper that is missing, the implementation should reconcile `src/api.ts`/`src/api-types.ts` with contract source and generated artifacts. Generated files remain non-editable.

Rejected alternative: allow panel code to scatter raw endpoints or copy stale local DTOs. That would make future contract-driven UI work harder and less trustworthy.

### Decision 5: Add a host preservation gate

`frontend-new` should gain a host check equivalent to the old `check-deck-ui-host` guard. It should verify boot path, registry inventory, panel component cases, no retired restoration preview code, no missing registry cases, and explicit `chat`/`agents` authority.

Rejected alternative: rely only on TypeScript build. TypeScript can pass while the shell still exposes only two panels.

## Risks / Trade-offs

- [Risk] Old panel code can carry pre-contract assumptions into `frontend-new` → Mitigation: classify those modules as `preserved`, keep raw endpoint use behind `src/api.ts`, and record contract discrepancies instead of silently inventing DTOs.
- [Risk] i18n merge can overwrite new `agentsPanel` strings or remove old panel namespaces → Mitigation: merge by namespace, keep new agents keys authoritative, and add tests/build checks for missing translation keys.
- [Risk] Copying old `deck-ui` host can overwrite `frontend-new` design-system assumptions → Mitigation: preserve `frontend-new/src/design-system` as authority and only adapt host imports/classes around it.
- [Risk] `frontend-new-workspace` base spec still contains scaffold-era requirements → Mitigation: this change explicitly removes the empty-panel requirement and replaces it with complete-surface requirements.
- [Risk] Future redesign work may confuse preserved modules for final design quality → Mitigation: add preservation status metadata and documentation so preserved modules are known-good product coverage, not final redesign output.

## Migration Plan

1. Establish inventory and authority map: list old `frontend` panels, classify `chat`/`agents` as `new`, classify all remaining panels as `preserved`, and identify dependency chains.
2. Restore the host spine in `frontend-new`: `deck-ui` host, registry, component registry, navigation helpers, UI store, shell/header/nav, shortcuts, error boundary, and toast/runtime wrappers.
3. Restore shared dependencies: `components/shared`, `components/runtime`, theme CSS support, hooks/lib/store utilities, and i18n namespaces.
4. Restore preserved panels in groups that match the old registry: core, observe, automate, and control. Do not overwrite `chat` or `agents`.
5. Reconcile API/types through `frontend-new/src/api.ts`, `src/api-types.ts`, and contract sources. Regenerate only from source contracts when needed.
6. Add/port host guard and focused tests for registry inventory, panel host routing, preserved panel smoke rendering, and new `chat`/`agents` authority.
7. Run frontend build/tests and browser smoke through representative panels.

Rollback strategy: because all work lands inside `frontend-new`, rollback can remove the restored host/preserved panel imports and return to the previous `chat`/`agents` shell without touching frozen `frontend`. Any contract source changes should be reverted through their source files and regenerated.
