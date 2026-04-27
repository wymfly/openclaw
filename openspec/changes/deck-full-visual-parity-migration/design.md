## Context

The previous migration closed a large amount of Vite/Go frontend functionality, but it did not actually complete a full old Deck visual migration. A fresh code comparison shows the gap is structural, not cosmetic:

| Area      | Old Next Deck evidence                                                                                                                                | Current Vite Deck evidence                                                                       | Meaning                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Shell     | `dashboard/src/components/layout/Shell.tsx`, `HeaderBar.tsx`, `NavRail.tsx`, `PanelErrorBoundary.tsx`, `KeyboardShortcutsDialog.tsx`, `ThemeSync.tsx` | `deck-go/frontend/src/deck-ui/Shell.tsx`, `HeaderBar.tsx`, `NavRail.tsx`                         | Vite shell is simpler and misses several global UX surfaces.                                          |
| App frame | `dashboard/src/app/page.tsx` includes onboarding, toast SSE, shortcuts dialog, error boundary, suspense fallback                                      | `deck-go/frontend/src/deck-ui/App.tsx` focuses on auth/bootstrap and panel host                  | App-level interaction parity is incomplete.                                                           |
| i18n      | Old Deck panel files widely use `useTranslations("...")`; EN/ZH JSON has ~1,979 flattened keys                                                        | Vite JSON has keys, but many Vite panels still contain local labels and simplified text surfaces | JSON presence is not enough; every visible panel copy must be wired.                                  |
| Agents    | old 28 non-test UI files                                                                                                                              | current 3 non-test UI files                                                                      | Old tabbed/detail/list/compare/editor UI is not migrated.                                             |
| Channels  | old 44 non-test UI files                                                                                                                              | current 5 non-test UI files                                                                      | Old wizard/access/detail/analytics/binding UI is not migrated.                                        |
| Models    | old 31 non-test UI files                                                                                                                              | current 3 non-test UI files                                                                      | Old catalog/config/fallbacks/usage UI is not migrated.                                                |
| Chat      | old 60 non-test UI files                                                                                                                              | current 51 non-test UI files                                                                     | Chat is closer, but missing shared renderer, bash/diff/highlight/raw views, and subagent card parity. |
| Settings  | old 10 non-test UI files                                                                                                                              | current 1 non-test UI file                                                                       | Sectioned settings UI is not migrated.                                                                |

The right framing is therefore:

```
        OLD NEXT DECK                   VITE + GO DECK
  ┌─────────────────────┐          ┌─────────────────────┐
  │ visual authority    │          │ target runtime      │
  │ interaction model   │─────────▶│ same UX semantics   │
  │ i18n copy surface   │          │ Go-backed data      │
  │ panel decomposition │          │ Vite packaging      │
  └─────────────────────┘          └─────────────────────┘
             │                                ▲
             └────── not design.md redesign ─┘
```

## Goals / Non-Goals

**Goals:**

- Reset visual migration completion criteria to old Deck perceptual and interaction parity.
- Split work into independently reviewable OpenSpec changes so each proposal is tied to real code differences.
- Preserve current Go backend and Gateway API source-of-truth boundaries.
- Treat Go backend/API/projection gaps as in-scope when old Node+Next service behavior is required by the migrated frontend and the Gateway source of truth supports the capability.
- Make desktop Web parity blocking before any renewed claim of full visual migration.
- Require panel-local EN/ZH copy parity, not only nav label translation.
- Require each panel plan to list old authority files, current Vite target files, missing visual structures, and validation evidence.

**Non-Goals:**

- Do not implement application code in this umbrella change.
- Do not redesign using `design.md` aesthetics in this phase.
- Do not require pixel-level equality.
- Do not make mobile visual parity blocking.
- Do not replace Gateway authority with old Next API behavior that the Gateway does not support.

## Decisions

### D1: Make this change an umbrella, not the implementation unit

**Decision:** `deck-full-visual-parity-migration` governs scope, sequencing, and acceptance. Actual implementation is split into child changes.

**Rationale:** The code gap is too large for one implementation proposal. For example, `channels` alone has a 44-file old UI tree versus a 5-file current Vite tree. A single implementation change would hide reviewable boundaries.

**Rejected:** One giant “finish all visual migration” implementation change. It would be difficult to validate, difficult to review, and likely to repeat the previous false-completion problem.

### D2: Use old Deck component decomposition as the migration map

**Decision:** Each panel plan starts from `dashboard/src/components/panels/<panel>/` and maps files/components to `deck-go/frontend/src/components/panels/<panel>/`.

**Rationale:** Visual style, interactions, tabs, dialogs, and empty/error/loading states are encoded in the old component tree. Migrating only final DOM appearance would miss behavior.

**Rejected:** Continue styling current simplified single-file panels. That may improve appearance but cannot recover missing wizards, tabs, dialogs, or renderer behavior.

### D3: Split by risk and navigation group

**Decision:** Use these child changes:

- `deck-shell-i18n-parity`: global shell, nav, header, theme, i18n completeness, shared primitives.
- `deck-chat-visual-parity`: Chat visual/interaction/rendering parity.
- `deck-core-panels-visual-parity`: Agents, Gateway/Monitor, Models.
- `deck-observe-panels-visual-parity`: Usage, Sessions, Memory, Logs, Activity, Threads, API Explorer.
- `deck-automate-panels-visual-parity`: Cron/Scheduler, Webhooks, Approvals, Skills.
- `deck-control-panels-visual-parity`: Budget, Alerts, Channels, Plugins, Routing, Subagents, Identity, Config, Nodes, Docs, Settings.

**Rationale:** This follows old Deck navigation groups while isolating the highest-risk surfaces: Chat, Agents, Channels, Models, and Settings.

### D4: Validate visually and behaviorally

**Decision:** Each child change must produce browser evidence for its panel set and a reference comparison checklist against old Deck.

**Rationale:** Static tests cannot prove perceptual parity. Prior closure relied too heavily on “panel opens” traversal and missed obvious UI differences.

### D5: i18n parity is a first-class migration target

**Decision:** A panel is not visually migrated if switching EN/ZH leaves panel-local copy in English, except for proper nouns, API identifiers, code, method names, tokens, or user data.

**Rationale:** The user explicitly identified nav-only switching as a blocker. Old Deck already had broad i18n coverage; Vite must preserve it.

### D6: Backend parity gaps are fixed with the panel that exposes them

**Decision:** If porting an old UI interaction reveals that the Go backend lacks a route, projection field, snapshot, stream event, mutation, or error shape that the old Node+Next service provided, the owning child change must either add or fix the Go backend contract or document a Gateway-source limitation.

**Rationale:** True frontend migration cannot be completed by silently dropping controls, hardcoding fake data, or leaving affordances disabled because the Go backend is incomplete.

**Rejected:** Treat backend/API gaps as out of scope for visual parity. That would preserve the appearance of migration while leaving old Deck workflows broken.

### D7: Remaining child changes may run in parallel from the same baseline

**Decision:** After `deck-shell-i18n-parity` and `deck-chat-visual-parity` are complete, the Core, Observe, Automate, and Control child changes may be implemented in separate worktrees from baseline commit `341d965a36`.

**Guardrails:**

- Each worktree owns its declared panel directories and its own OpenSpec change directory.
- Shared frontend surfaces (`deck-go/frontend/src/api.ts`, `deck-go/frontend/src/i18n/en.json`, `deck-go/frontend/src/i18n/zh.json`, `deck-go/frontend/src/theme.css`, `deck-go/frontend/src/components/shared/**`, and `deck-go/frontend/src/deck-ui/**`) must be changed only for panel-local namespaces or via a deliberate shared-baseline patch.
- Go backend/API edits are allowed only when the panel's `backend-gaps.md` records the old workflow, Gateway/source support, Go gap, decision, and verification evidence.
- Desktop Web is the blocking visual target; mobile parity remains deferred.
- Browser validation should use the Playwright/browser plugin path, not the old CLI smoke path.

**Rationale:** The remaining proposals are split by navigation group and mostly disjoint by panel directory, but they share transport, i18n, theme, shell, shared-list primitives, and Go gateway facade files. Explicit ownership keeps parallel worktree fan-out reviewable.

## Risks / Trade-offs

- **Risk: Old Deck components depend on Next-only APIs.** → Mitigation: introduce compatibility adapters only at framework boundaries (`next-intl`, routing, API transport), not inside panel UI code.
- **Risk: Old UI expects old Next API routes.** → Mitigation: keep Go/Gateway data authority and adapt panel props/stores to Vite APIs.
- **Risk: Reusing old visual code reintroduces old business logic.** → Mitigation: separate UI component migration from data hook/store migration; test against Go backend contracts.
- **Risk: Backend parity expands child changes.** → Mitigation: require a small backend gap ledger per panel and fix only gaps needed for old Deck workflow parity.
- **Risk: Too many panels slow progress.** → Mitigation: implement child changes in order, with per-panel acceptance instead of waiting for a final monolith.
- **Risk: Visual parity still subjective.** → Mitigation: require old/current desktop screenshots, interaction checklist, i18n switch proof, and explicit non-parity exceptions.

## Migration Plan

1. Complete the umbrella proposal set and child proposal artifacts.
2. Implement `deck-shell-i18n-parity` first to stabilize global layout, shared tokens, i18n plumbing, and evidence tooling.
3. Implement `deck-chat-visual-parity` second because Chat is the highest-value and highest-interaction surface.
4. Implement `deck-core-panels-visual-parity`, prioritizing Agents and Models before Gateway/Monitor.
5. Implement `deck-observe-panels-visual-parity`.
6. Implement `deck-automate-panels-visual-parity`.
7. Implement `deck-control-panels-visual-parity`, with Channels and Settings treated as high-risk subtracks.
8. Run a final umbrella validation pass across all active desktop panels.

Rollback strategy: each child change should remain independently revertible. Frontend-only visual/interface edits are cleanly revertible; Go backend/API edits are allowed only when they close a documented old Deck workflow gap and must carry targeted regression evidence.

## Open Questions

- Should `deck-go/frontend` eventually restore Tailwind/shadcn class usage from old Deck, or keep the current CSS-variable layer while matching old perceptual output?
- Should `gateway` remain a Vite-specific renamed Monitor panel, or should it visually restore old `MonitorPanel` while keeping the nav label “Gateway”?
- Should old onboarding be restored in Vite now, or remain out of scope because the Go backend has a different bootstrap/auth model?
- Which old Node+Next API routes or service projections lack an equivalent in the Go backend after the current migration commit?
