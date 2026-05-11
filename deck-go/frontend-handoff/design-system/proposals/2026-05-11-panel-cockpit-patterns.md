# Panel Cockpit Patterns

**Date**: 2026-05-11
**Author**: Codex
**Type**: pattern-add
**Status**: applied

## What's changing

Promote the repeated Sessions and Usage cockpit structures into shared
design-system patterns:

- `PanelRoot`
- `PanelSurface`
- `KpiStrip`
- `PanelMetric`
- `PanelSectionHeader`
- `PanelStatusRow`
- `PanelPill`

## Why

Sessions and Usage independently converged on the same visual structure after
prototype parity work: dense panel typography, bordered surfaces, KPI/stat
strips, uppercase metric labels, strong values, subdued hints, compact section
headers, and wrapping status rows.

The evidence says the reusable layer is a cockpit pattern set, not a global
token-value rewrite. Existing canonical `--ds-*` tokens are sufficient; the
problem was repeated local structure and stale module-local aliases.

## Files touched in this directory

- `design-system/proposals/2026-05-11-panel-cockpit-patterns.md`
- `modules/sessions/implementation-notes.md`
- `modules/usage/implementation-notes.md`

## Files Claude Code should touch

- `frontend-new/src/design-system/patterns/PanelCockpit.tsx`
- `frontend-new/src/design-system/patterns/panel-cockpit.css`
- `frontend-new/src/design-system/patterns/index.ts`
- `frontend-new/src/design-system/dev/Gallery.tsx`
- `frontend-new/src/components/panels/sessions/SessionsPanel.tsx`
- `frontend-new/src/components/panels/usage/UsagePanel.tsx`
- `frontend-new/src/components/panels/usage/SummaryCards.tsx`

## Impact

- Breaking: no public runtime API break; module tests and visual E2E selectors
  were updated where old local classes represented promoted structures.
- Affects modules: sessions, usage, and future cockpit-style panels.
- Estimated implementation effort: medium.

## Open questions for Claude Code

- Validate one third module before converting remaining local panel molecules or
  enforcing a repo-wide migration rule.
- Keep chart, quota, transcript, inventory row, and action-form molecules
  module-local until a second independent module needs the same anatomy.

## Resolution

- Decision: applied
- Notes: Implemented as token-only CSS using current canonical `--ds-*` tokens.
  Public props intentionally do not expose `className` or `style`; consumers
  migrate through semantic props and slots.
