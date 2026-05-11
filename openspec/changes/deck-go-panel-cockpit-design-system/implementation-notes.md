# Panel Cockpit Design System Implementation Notes

## Reuse Baseline

Source modules:

- Sessions: `deck-go/frontend-new/src/components/panels/sessions/SessionsPanel.tsx` and `sessions-panel.css`
- Usage: `deck-go/frontend-new/src/components/panels/usage/UsagePanel.tsx`, `SummaryCards.tsx`, `SessionUsageList.tsx`, `ProviderQuotaPanel.tsx`, and `usage-panel.css`

Repeated structures observed in both modules:

- Panel root: dense dashboard panel with Inter typography, zero letter spacing, `box-sizing: border-box`, and grid gap rhythm.
- Panel surface: bordered 8px-radius content block using `--ds-bg-2`, `--ds-border`, no nested-card shadow decoration except Sessions' existing outer card shadow.
- KPI strip: responsive grid of metric tiles with label/value/hint; Sessions uses five `.sessions-metric` tiles, Usage uses six `.usage-panel__metric` tiles.
- KPI tile: uppercase mono-ish/meta label, strong value, optional hint, ellipsis protection, and minimum tile height.
- Section header: title stack plus optional meta/actions slot; repeated as `.sessions-section-heading`, `.usage-panel__card-head`, and root header action rows.
- Status row: wrapping inline row for badges/pills and compact status facts; repeated as `.sessions-status-row`, `.usage-panel__pill-row`, and usage header action pills.
- Pill: compact bordered status/meta chip with neutral and positive tones; Usage currently implements `.usage-panel__pill`, Sessions mostly uses `Badge`.

## API Decision

The shared cockpit pattern is intentionally structural, not a raw styling escape hatch. New component props must not expose `className` or `style`; consumers pass semantic content, tone, density, title, metadata, and actions. Existing module-specific classes may remain temporarily around non-promoted molecules during reference migration, but promoted structures should render through `PanelRoot`, `PanelSurface`, `KpiStrip`, `PanelMetric`, `PanelSectionHeader`, `PanelStatusRow`, and `PanelPill`.

## Token Decision

No canonical token changes are required for this first extraction. The repeated visuals are expressible with existing `--ds-*` typography, spacing, radius, color, border, and shadow tokens plus token-only pattern CSS. Module CSS may keep local layout/molecule rules for non-promoted areas, but it must not reintroduce stale aliases such as `--surface-*`, `--text-*`, or `--line-*`.

## Reference Consumer Scope

Reference migration targets:

- Sessions: replace local metric/stat helpers and repeated section/status wrappers where the cockpit pattern can preserve behavior without touching data contracts.
- Usage: replace summary metrics and repeated header/status/pill structures where the cockpit pattern can preserve the visual parity fixes already accepted.

Deferred:

- Full removal of all module-local molecules is intentionally out of scope. Inventory rows, usage charts, quota progress rows, transcript rows, and action forms still carry module-specific behavior and layout.
