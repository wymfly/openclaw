# subagents components

This file describes production molecules used by `prototype.html`. The names are
handoff labels, not required exported React components.

## Shell

- `SubagentsWorkbench`: page-level grid with a compact header, metric strip, run
  queue, and selected-run workspace.
- `SubagentsHeader`: title, short operational description, load status badge,
  auto-refresh toggle, and refresh action.
- `SubagentsMetrics`: five equal tiles for visible runs, server total, active,
  history, and selected depth/model.

## Run Triage

- `RunFilters`: child-agent select, requester input, status select, time-range
  select, and refresh controls.
- `RunQueue`: stable list with fixed row rhythm. Rows expose child agent,
  requester, run id, status, depth, duration, spawn mode, model, and task.
- `RunQueueRow`: selectable button row. Selected state uses a left accent and
  tinted background, not a size change.

## Selected Run

- `SelectedRunHero`: primary identity for the selected child run, status badges,
  depth, mode, model, created time, duration, and raw run id.
- `RunDetailGrid`: contract fields only. Missing optional values render as the
  common unavailable label.
- `RunNavigationActions`: open child agent, requester agent, child session, and
  requester session.
- `SteerKillPanel`: free-form instruction textarea, steer button, and
  confirmation-gated kill button.

## Lineage

- `LineageHero`: root session and node count.
- `LineageTimeline`: nested tree built from `parentRunId`. Each node displays
  agent, run id, status, depth, duration when present, and task when present.
- `PayloadDetails`: raw selected run, lineage, and last action payloads.

## Config

- `GlobalDefaultsCard`: conservative editor for `agents.defaults.subagents`.
  Numeric fields clamp to existing frontend limits.
- `PerAgentPermissions`: permission rows from
  `DeckGoAgentSubagentConfigResponse`, with a navigation action into the agent
  subagents surface.

## Empty And Error

- `SubagentsEmpty`: uses module copy only; does not imply unsupported recovery.
- `SubagentsError`: inline banner with the thrown error message and a retry
  action.
