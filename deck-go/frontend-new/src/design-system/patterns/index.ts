/**
 * design-system patterns — cross-module layout shells.
 *
 * Patterns sit between atoms (single-purpose primitives) and panels (business
 * surfaces). They encode shell shapes that recur across modules — page chrome,
 * navigation rail, empty states — so panels do not redefine these structures.
 *
 * See `README.md` for the inclusion gate (≥ 2 modules + reuse analysis).
 */

export { PageShell, type PageShellProps } from "./PageShell";
export { NavRail, type NavRailItem, type NavRailProps } from "./NavRail";
export { TopBar, type TopBarProps } from "./TopBar";
export { EmptyState, type EmptyStateProps, type EmptyStateTone } from "./EmptyState";
export { KbdHint, type KbdHintProps } from "./KbdHint";
export {
  KpiStrip,
  PanelMetric,
  PanelPill,
  PanelRoot,
  PanelSectionHeader,
  PanelStatusRow,
  PanelSurface,
  type KpiStripProps,
  type PanelMetricProps,
  type PanelMetricTone,
  type PanelPillProps,
  type PanelPillTone,
  type PanelRootDensity,
  type PanelRootProps,
  type PanelSectionHeaderProps,
  type PanelStatusRowAlign,
  type PanelStatusRowProps,
  type PanelSurfaceProps,
  type PanelSurfaceTone,
} from "./PanelCockpit";
export { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
