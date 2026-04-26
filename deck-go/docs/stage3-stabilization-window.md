# Stage 3 Stabilization Window

This document now tracks an optional post-Stage-3 validation window rather than
a hard Stage 3 closure gate.

Use it when you still want structured observation after Stage 3 closeout, or
when later integrated E2E / operational testing should accumulate incident
evidence in one place.

The source-of-truth ledger is `deck-go/docs/stage3-stabilization-window.json`.

## Current window

- Opened: `2026-04-23`
- Window length: `14` days
- Earliest pass date: `2026-05-07`
- Supported environments:
  - Linux local/private deployment
  - macOS local/private deployment

This window was opened only after these Stage 3 closure gates were already
green:

- `cd deck-go && make verify`
- Codex Playwright plugin E2E for the active Vite host, managed source
  Gateway, high-value panels, direct API checks, and Chat send/receive. Latest
  foreground-stack proof used backend `62811`, frontend `62812`, managed source
  Gateway `18811`, and rendered Chat `959595 -> 959596` with console 0 errors
  / 0 warnings.
- `cd deck-go && make smoke-stage3-rollback`

Do not use `make smoke-stage3-host` or `make smoke-stage3-e2e` as follow-on
Codex/Ralph browser evidence. Those shell-launched Playwright lanes are
deprecated for this environment because Chrome/Chromium startup is blocked by
process-control failures.

## What counts as blocking follow-on evidence

The window fails immediately if a Sev-1 or Sev-2 regression attributable to
`deck-go` is recorded in the ledger, including:

- operator-blocking auth or bootstrap failure
- transcript/replay corruption
- send/abort or reconnect failures that break the operator workflow
- config corruption or operator-visible data loss
- rollback failure caused by the new Stage 3 host path

Lower-severity issues may still be logged, but they do not represent blocking
follow-on evidence unless they are later reclassified to Sev-1 or Sev-2.

Allowed severities are:

- `sev1`
- `sev2`
- `sev3`
- `sev4`
- `info`

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

Supported wrapper:

```bash
cd deck-go
make record-stage3-stabilization-incident \
  DATE=2026-04-25 \
  SEVERITY=sev3 \
  SUMMARY="Intermittent visual flicker in the Sessions panel after reload." \
  ATTRIBUTION="deck-go/frontend" \
  STATUS=monitoring
```

## How to check status

Human-readable status:

```bash
cd deck-go
node scripts/check-stage3-stabilization.mjs
```

Alternate ledger validation:

```bash
cd deck-go
node scripts/check-stage3-stabilization.mjs --file /tmp/stage3-ledger.json
```

Optional enforced gate:

```bash
cd deck-go
node scripts/check-stage3-stabilization.mjs --enforce
```

Make wrappers:

```bash
cd deck-go
make check-stage3-stabilization

make deck-go-stage3-stabilization

make deck-go-stage3-stabilization-enforce
```

`--enforce` is expected to fail until both conditions are true:

- the current date is on or after `2026-05-07`
- no Sev-1/Sev-2 incidents attributable to `deck-go` are recorded in the ledger

That failure is no longer a Stage 3 blocker by itself; it is only useful if you
choose to keep this follow-on observation window active.
