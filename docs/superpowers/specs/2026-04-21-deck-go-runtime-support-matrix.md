# Deck Go Stage 2 Runtime Support Matrix

## Purpose

Define the initial runtime-facing capability baseline for the first Stage 2
cutover. This is the concrete form of the approved `Runtime support scope`
decision in the Stage 2 PRD.

## Supported Baseline

These runtime-facing areas are in scope for the first Stage 2 delivery because
they already have proven Stage 1 operator value and must be expressible through
the Stage 2 control-plane contracts.

| Capability family | Stage 2 baseline | Notes |
| --- | --- | --- |
| Runtime connectivity / health / capabilities | supported | replaces current bootstrap/runtime views |
| Session list / session detail | supported | first-load state comes from projections |
| Chat send / abort / stream / steer / compact | supported | command ack + projection/realtime update model |
| Approvals pending / resolve | supported | remains operator-facing baseline |
| Docs extract / list / detail | supported | list/detail becomes query model, extract remains command |
| Channels probe / test where already Stage-1-proven | supported | no new broad channel taxonomy in first cutover |
| Webhooks CRUD / test / history | supported | Stage 2 still does not imply automatic retry parity |
| Monitor / activity summaries | supported | projection-backed operator view |
| Canvas / media normal usage | supported | canvas summary + patch stream; media stays backend-owned |

## Explicitly Deferred

| Capability family | Deferred reason |
| --- | --- |
| Multi-runtime orchestration | outside first single-runtime cutover |
| Enterprise RBAC / tenancy / audit explorer | enterprise platform scope, not first delivery |
| Broad channel parity beyond Stage-1-proven baseline | would expand adapter and UI taxonomy too early |
| Durable canonical event log | projection-first persistence chosen for first delivery |
| Automatic webhook retry parity | explicitly deferred by Stage 1 and preserved in Stage 2 baseline |
| Local runtime start/stop supervision from desktop shell | deferred until sidecar packaging is proven |

## Runtime Method / Event Policy

The first Stage 2 adapter does **not** promise raw-runtime method parity.
Instead:

- supported runtime methods/events are only those required to back the supported
  baseline above
- unsupported runtime methods/events may still exist in OpenClaw but remain
  adapter-deferred until a later Stage 2 or Stage 3 plan promotes them

## Consequence

A Stage 2 worker should treat any requested runtime capability outside this
matrix as:

- either a new Stage 2 planning gate
- or a later follow-up, not an implicit implementation requirement
