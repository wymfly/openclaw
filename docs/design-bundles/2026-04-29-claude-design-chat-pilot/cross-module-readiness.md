# Cross-Module Readiness Matrix

**Maintainer:** frontend-chat-parity-and-foundation-audit
**Audit date:** 2026-04-30
**Atom set version:** P1a (11 atoms) + P1b (25 atoms) = 36 atoms (per `deck-go/frontend/src/design-system/atoms/index.ts`)
**Bundle reference:** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/project/`
**Spec:** `openspec/changes/frontend-chat-parity-and-foundation-audit/specs/design-system-cross-module-readiness/spec.md`

This matrix is the readiness gate for any non-chat panel migrating to the design system. Before a panel migration proposal merges, the panel team SHALL confirm each `extend` and `missing` cell is either resolved (atom shipped) or accepted as a downstream follow-up.

---

## Status Legend

| Status    | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `applies` | Atom usable as-is (no API change needed)                            |
| `extend`  | Atom needs a new variant or prop (additive change to existing atom) |
| `missing` | No atom covers this need — propose new atom                         |
| `n/a`     | Panel has no need for this atom                                     |

Per the **no-breaking-change promise** spec requirement, `extend` cells SHALL be additive variants only. Backwards-incompatible changes require a new atom (e.g., `CardV2`) rather than re-architecting the existing one.

---

## Target Panels (one row per panel)

| Panel        | Path                                                                                    | theme.css footprint | What it does today                                                                    |
| ------------ | --------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| **Settings** | `panels/settings/SettingsPanel.tsx`                                                     | 64 lines            | Manages workspace settings, runtime config, gateway tokens, confirm dialogs           |
| **Models**   | `panels/models/ModelsPanel.tsx` + `ProviderModelsEditor.tsx` + `StringRecordEditor.tsx` | 145 lines           | Provider/model catalog, fallback chain editor, quota cards, usage bars, tabbed config |
| **Channels** | `panels/channels/ChannelsPanel.tsx` + 4 sub-components                                  | 87 lines            | Channel account cards, WeCom routing/access controls, usage charts, form grids        |
| **Sessions** | `panels/sessions/SessionsPanel.tsx` + 3 sub-components                                  | 80 lines            | Session list, detail shell, compaction history, subagent tree, usage breakdown        |
| **Logs**     | `panels/logs/LogsPanel.tsx`                                                             | 41 lines            | Log tape view, level filters, controls strip, sidecar event details                   |

**Shared shell footprint** (used across all 5 panels): `deckgo-card` (58 refs in theme.css), `deckgo-selectable-card` (86 refs), `deckgo-shell-list` (12 refs), `deckgo-panel-workspace`, `deckgo-panel-hero-strip`, `deckgo-actions`, `deckgo-pill-row`, `deckgo-form-grid`, `deckgo-grid`, `deckgo-grid-2`, `deckgo-grid-3`, `deckgo-meta`, `deckgo-note`, `deckgo-kicker`, `deckgo-label`, `deckgo-input`, `deckgo-textarea`, `deckgo-button`, `deckgo-pill`, `deckgo-surface-label`, `deckgo-surface-tile`, `deckgo-checkbox-row`, `deckgo-dividerless`.

---

## Worklist (cross-cutting blockers)

These items SHALL be resolved before the corresponding panel migration begins. Each item has 3 fields: **what** (atom name), **scope** (which panels need it), **effort** (S/M/L approximate atom-introduction effort).

### Missing atoms — must ship as new atom-introduction changes

| Atom             | Scope (panels)                   | Effort | One-line justification                                                                                                                                                                                         |
| ---------------- | -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DataTable`      | Models, Sessions, Logs           | L      | Sortable columns + row hover + empty state + per-cell renderers; current `TableView` is text-only and read-only. Bundle has no equivalent (chat doesn't need it), so this is panel-driven.                     |
| `TreeView`       | Models                           | M      | Provider tree (group → provider → model nesting) needs collapsible/expandable rows with focus mgmt. `SidebarRow` is single-level.                                                                              |
| `KpiCard`        | Channels, Models, Sessions, Logs | S      | Stats blocks (deckgo-card variant for `title + big-value + delta + sparkline-slot`). Could be implemented as `Card variant="kpi"` extension instead of a new atom — see Card row below.                        |
| `SparklineChart` | Models, Channels, Logs           | M      | Inline 60×16 bar/line micro-chart for usage trends. Currently 30+ lines of raw CSS in deckgo-usage-chart-\*. Distinct atom because it has its own a11y semantics (role="img" + aria-label + numeric fallback). |
| `HeroStrip`      | All 5 panels                     | S      | Every panel uses `deckgo-panel-hero-strip` for the top status/title/cta row. Promote to atom.                                                                                                                  |
| `EmptyState`     | Channels, Models, Sessions, Logs | S      | Illustration + title + description + action slot pattern repeated across panels. Chat already has `EmptyState.tsx` (chat-widgets) — this proposal promotes it to an atom in §10.                               |
| `PaginationBar`  | Sessions, Logs                   | S      | First/prev/next/last + page-size + count. Pure new atom.                                                                                                                                                       |
| `KeyValueList`   | Settings, Sessions               | S      | `<dt>/<dd>` pairs styled as "label: value" with copy button on value. Currently inline tables.                                                                                                                 |

### Existing atoms needing additive variants (`extend`)

| Atom               | New variant / prop                                                                                                                                                             | Scope                                   | One-line justification                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Card`             | `variant="hero"` (panel-hero-strip styling) + `variant="selectable"` (deckgo-selectable-card border highlight) + `variant="kpi"` (KpiCard pattern, as alternative to new atom) | All panels                              | Three patterns repeat across panels; current variants `flat / elevated / inset` don't cover them. Additive only.                |
| `Banner`           | `live="polite"` for save-success / error toasts (already supported per `BannerLive` type — confirm existing)                                                                   | Settings, Models, Channels              | Verify the existing Banner atom already covers panel save-success messages without API change. If not, add `variant="success"`. |
| `Code`             | `copyable` prop (existing? confirm) + `language` prop for syntax highlight                                                                                                     | Settings (token), Sessions (code), Logs | Logs panel needs copy affordance + language hint. If `copyable` not yet on atom, add.                                           |
| `Textarea`         | `monospace` mode + `readonly` styling                                                                                                                                          | Models (raw JSON), Channels (raw JSON)  | JSON textareas need monospace font + read-only visual. Additive prop.                                                           |
| `Tab`              | confirm horizontal-strip variant works at panel scale (4-6 tabs vs chat's 2-3)                                                                                                 | Models                                  | Validation only — likely no API change.                                                                                         |
| `Modal`            | `size="lg"` for token-management dialogs in Settings                                                                                                                           | Settings                                | Existing `ModalSize` type — verify `lg` is in the union.                                                                        |
| `Input`            | `mask="token"` (mask all but last 4 chars) for Gateway token display in Settings                                                                                               | Settings                                | Token-display pattern. Could also be solved with a small `<TokenInput>` wrapper; defer to panel-migration time.                 |
| `SegmentedControl` | confirm 4-segment usage works (ModelsPanel has 4 tabs with segmented styling)                                                                                                  | Models                                  | Validation only.                                                                                                                |

### Atoms confirmed `applies` everywhere — no extension needed

`Button`, `IconButton`, `Badge`, `Chip`, `Tag`, `Spinner`, `SkeletonLoader`, `Select`, `Toggle`, `Radio`, `Slider`, `FileInput`, `Breadcrumb`, `SidebarRow`, `Popover`, `DropdownMenu`, `Tooltip`, `Toast`, `Markdown`, `DiffView`, `JsonTree`.

### Atoms confirmed `n/a` for panels (chat-only)

`StreamingCursor`, `WaitingDots`, `ProgressBar` (chat streaming), `Block` (chat block-chrome), `Drawer` (chat side-drawer; panels use full pages), `ContextMenu` (chat right-click).

---

## Per-Atom-Tier Matrix

### Tier 1: Action atoms

| Atom       | Settings | Models  | Channels | Sessions | Logs    |
| ---------- | -------- | ------- | -------- | -------- | ------- |
| Button     | applies  | applies | applies  | applies  | applies |
| IconButton | applies  | applies | applies  | applies  | applies |

### Tier 2: Status atoms

| Atom           | Settings                  | Models                    | Channels                  | Sessions | Logs                  |
| -------------- | ------------------------- | ------------------------- | ------------------------- | -------- | --------------------- |
| Badge          | applies                   | applies                   | applies                   | applies  | applies               |
| Chip           | applies                   | applies (filter chips)    | applies                   | applies  | applies (level chips) |
| Tag            | applies                   | applies (provider tags)   | applies                   | applies  | applies               |
| Spinner        | applies                   | applies                   | applies                   | applies  | applies               |
| SkeletonLoader | applies                   | applies                   | applies                   | applies  | applies               |
| Banner         | extend (success variant?) | extend (success variant?) | extend (success variant?) | applies  | applies               |

### Tier 3: Streaming atoms

| Atom            | Settings | Models                     | Channels                   | Sessions | Logs |
| --------------- | -------- | -------------------------- | -------------------------- | -------- | ---- |
| StreamingCursor | n/a      | n/a                        | n/a                        | n/a      | n/a  |
| WaitingDots     | n/a      | applies (provider probe)   | applies (channel probe)    | n/a      | n/a  |
| ProgressBar     | n/a      | extend (usage-bar variant) | extend (usage-bar variant) | n/a      | n/a  |

### Tier 4: Container atoms

| Atom   | Settings                          | Models                       | Channels          | Sessions     | Logs         |
| ------ | --------------------------------- | ---------------------------- | ----------------- | ------------ | ------------ |
| Card   | extend (selectable variant)       | extend (kpi+selectable+hero) | extend (kpi+hero) | extend (kpi) | extend (kpi) |
| Block  | n/a                               | n/a                          | n/a               | n/a          | n/a          |
| Drawer | n/a                               | n/a                          | n/a               | n/a          | n/a          |
| Modal  | extend (lg size for token dialog) | applies                      | applies           | applies      | applies      |

### Tier 5: Text atoms

| Atom      | Settings                   | Models                    | Channels                | Sessions                  | Logs                   |
| --------- | -------------------------- | ------------------------- | ----------------------- | ------------------------- | ---------------------- |
| Markdown  | applies (release notes)    | applies (provider docs)   | applies (channel docs)  | applies (session summary) | n/a                    |
| Code      | extend (copyable+language) | applies                   | applies                 | applies                   | extend (language hint) |
| DiffView  | n/a                        | applies (config diff)     | n/a                     | n/a                       | n/a                    |
| JsonTree  | n/a                        | applies (raw config view) | applies (wecom payload) | applies (subagent meta)   | applies (event detail) |
| TableView | n/a                        | n/a (need DataTable)      | n/a (need DataTable)    | n/a (need DataTable)      | n/a (need DataTable)   |

### Tier 6: Form atoms

| Atom      | Settings               | Models                         | Channels                    | Sessions | Logs                 |
| --------- | ---------------------- | ------------------------------ | --------------------------- | -------- | -------------------- |
| Input     | extend (token mask)    | applies                        | applies                     | applies  | applies              |
| Textarea  | applies                | extend (monospace+readonly)    | extend (monospace+readonly) | applies  | n/a                  |
| Select    | applies                | applies                        | applies                     | applies  | applies              |
| Toggle    | applies                | applies                        | applies                     | applies  | applies              |
| Radio     | applies                | applies                        | applies                     | applies  | applies              |
| Slider    | applies                | applies (quota)                | n/a                         | n/a      | n/a                  |
| FileInput | applies (token import) | applies (model catalog import) | applies (template upload)   | n/a      | applies (log import) |

### Tier 7: Navigation atoms

| Atom             | Settings                         | Models                                        | Channels | Sessions               | Logs                   |
| ---------------- | -------------------------------- | --------------------------------------------- | -------- | ---------------------- | ---------------------- |
| Tab              | applies                          | applies (4-tab strip)                         | applies  | applies (sub-detail)   | applies (level filter) |
| SegmentedControl | applies                          | applies (size mode)                           | applies  | applies                | applies                |
| Breadcrumb       | applies                          | applies (provider/model nav)                  | applies  | applies                | n/a                    |
| SidebarRow       | n/a (panel uses panel-workspace) | extend (provider-tree nesting → see TreeView) | n/a      | applies (session list) | n/a                    |

### Tier 8: Overlay atoms

| Atom         | Settings               | Models                 | Channels               | Sessions | Logs    |
| ------------ | ---------------------- | ---------------------- | ---------------------- | -------- | ------- |
| Popover      | applies                | applies                | applies                | applies  | applies |
| DropdownMenu | applies                | applies                | applies                | applies  | applies |
| Tooltip      | applies                | applies                | applies                | applies  | applies |
| Toast        | applies (save success) | applies (save success) | applies (save success) | applies  | applies |
| ContextMenu  | n/a                    | n/a                    | n/a                    | n/a      | n/a     |

---

## Per-Panel Notes

### Settings panel

**Migration readiness:** Medium — needs `Card variant="selectable"` extension + `Modal size="lg"` confirm + new atoms `KeyValueList` + optional `TokenInput` wrapper. Heavy use of confirm dialogs and token management modals — the bundle's `right-panel.jsx` doesn't have a parallel for token UI, so this is panel-driven design.

**Footnote — deprecated patterns:** None. Settings uses the canonical shared shell (`deckgo-panel-workspace` etc.) which is part of the cross-panel shell-token migration covered separately.

### Models panel

**Migration readiness:** Low — most complex panel. Blocking new atoms: `DataTable` (provider model list), `TreeView` (provider tree), `SparklineChart` (usage bars), `KpiCard` (quota cards). Without these, attempting migration will force re-architecting `Card` or `SidebarRow`, which the no-breaking-change promise prohibits.

**Footnote — deprecated patterns:** `deck-ui-models-fallback-chains` + `deck-ui-models-chain-card` use a custom flow-chart-like layout that may need a `FlowChart` atom or could be deferred and rendered with raw CSS. Decision deferred to ModelsPanel migration proposal.

### Channels panel

**Migration readiness:** Medium-Low — needs `KpiCard` + `SparklineChart` + `EmptyState` (promotion from chat) + `Banner success` variant confirm + `Textarea monospace+readonly` extension.

**Footnote — deprecated patterns:** `deckgo-usage-chart-*` family (5 classes) is panel-specific and would migrate to `SparklineChart` atom. WeCom-specific UI (`deck-ui-channels-wecom`) keeps panel-local CSS — those classes don't promote to atoms.

### Sessions panel

**Migration readiness:** Medium — needs `DataTable` + `PaginationBar` + `KeyValueList` + `KpiCard`. Otherwise mostly atom-applies.

**Footnote — deprecated patterns:** Subagent rendering (`deck-ui-sessions-subagent` + `SessionSubagentDetails.tsx`) shares structure with chat's SubagentTree atom — verify visual consistency at migration time.

### Logs panel

**Migration readiness:** High — smallest footprint (41 lines) and mostly applies/extends. Needs `Code language` extension + `KpiCard` + `EmptyState` + `PaginationBar`. No new core atoms required if `DataTable` lands.

**Footnote — deprecated patterns:** `deck-ui-logs-tape` + `deck-ui-logs-stream-events` use a custom event-stream visual that may stay panel-local rather than promoting to an atom.

---

## No-Atom-Re-Architecture Guarantee

Per spec requirement 2 (`design-system-cross-module-readiness`), the following invariants hold for the entire cross-module rollout:

1. **Existing atom public APIs are immutable** — the variant unions, prop shapes, and CSS class names of all 36 atoms in this matrix MUST NOT change in a backwards-incompatible way. Adding a new variant to an existing union (e.g., `CardSurface = "flat" | "elevated" | "inset" | "kpi"`) is allowed; renaming an existing variant is not.
2. **Missing atoms become new atoms, not API changes** — the 8 missing atoms in the Worklist (`DataTable`, `TreeView`, `KpiCard`, `SparklineChart`, `HeroStrip`, `EmptyState`, `PaginationBar`, `KeyValueList`) SHALL each ship as a new atom-introduction change, not as an extension of an existing atom (with the documented exception of `KpiCard` which MAY be implemented as a `Card variant="kpi"` extension).
3. **Re-architecture triggers a new atom** — if a panel migration discovers the existing atom's API is fundamentally insufficient (e.g., `Modal` needs a new lifecycle hook), a `ModalV2` atom SHALL be introduced rather than changing `Modal`'s public surface. The matrix's "completed migrations" appendix tracks the deprecation/migration path.

---

## Completed Migrations (appendix)

_Empty — no panel migrations have completed yet. As panels migrate, their rows move here with a link to the archived OpenSpec change._

---

## Maintenance

This matrix is updated whenever:

- (a) A new atom is added to `deck-go/frontend/src/design-system/atoms/` → add a new column + per-panel cell.
- (b) A new target panel is identified → add a new row + per-atom cell.
- (c) A panel migration completes → move its row to the "Completed Migrations" appendix above and link to the archived OpenSpec change.

The current state above reflects audit on 2026-04-30. Subsequent atom or panel additions should append rather than replace entries to preserve the audit trail.

### Maintenance log

- **2026-04-30 — chat-parity §10 (Block atom role markers)**: 5 semantic-only role classes added (`ds-block--tool-use`, `--tool-result`, `--file`, `--canvas`, `--unknown`) to the existing `Block` atom CSS. No visual/API change; consumers keep their per-component chrome. Block atom remains `n/a` for panels (chat-only). No Worklist update required.
- **2026-04-30 — chat-parity §11 (axe automation)**: Added `vitest-axe` matcher across all 36 atom test files. Every atom passes with zero violations — no atom required a `disableRules` override. This is a regression gate (no atom API/surface change) and does not affect panel readiness.
