# Stage 3 Stabilization Window

This document tracks the final remaining closure gate for Stage 3:

- two full weeks with no Sev-1 or Sev-2 regressions attributable to `deck-go`

The source-of-truth ledger is `deck-go/docs/stage3-stabilization-window.json`.

## Current window

- Opened: `2026-04-23`
- Window length: `14` days
- Earliest pass date: `2026-05-07`
- Supported environments:
  - Linux local/private deployment
  - macOS local/private deployment

The window was opened only after these gates were already green:

- `cd deck-go && make verify`
- `cd deck-go && make smoke-stage3-e2e`
- `cd deck-go && make smoke-stage3-rollback`

## What counts as failure

The window fails immediately if a Sev-1 or Sev-2 regression attributable to
`deck-go` is recorded in the ledger, including:

- operator-blocking auth or bootstrap failure
- transcript/replay corruption
- send/abort or reconnect failures that break the operator workflow
- config corruption or operator-visible data loss
- rollback failure caused by the new Stage 3 host path

Lower-severity issues may still be logged, but they do not block closure unless
they are later reclassified to Sev-1 or Sev-2.

## How to update the ledger

Edit `deck-go/docs/stage3-stabilization-window.json` and append incidents to the
`incidents` array with:

- `date`
- `severity`
- `summary`
- optional `attribution`
- optional `status`

Example:

```json
{
  "date": "2026-04-25",
  "severity": "sev3",
  "summary": "Intermittent visual flicker in the Sessions panel after reload.",
  "attribution": "deck-go/frontend",
  "status": "monitoring"
}
```

## How to check status

Human-readable status:

```bash
cd deck-go
node scripts/check-stage3-stabilization.mjs
```

Enforced gate:

```bash
cd deck-go
node scripts/check-stage3-stabilization.mjs --enforce
```

Make wrappers:

```bash
cd deck-go
make check-stage3-stabilization

make deck-go-stage3-stabilization
```
