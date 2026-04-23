# Rollback Runbook

Rollback target: restore legacy `dashboard/` as the default Deck implementation.

## Rollback triggers

- transcript or replay corruption
- send/abort unreliability on critical paths
- config corruption or loss
- repeated reconnect failures that break operator workflow
- install or upgrade path failure on supported environments

## Rehearsal requirements

- rollback must be rehearsed before cutover
- rehearsal must verify that the legacy stack can be restored without losing required operator functionality

## Checklist

- [ ] Legacy `dashboard/` remains runnable throughout stabilization window
- [x] Legacy launch procedure is documented
- [x] Traffic/default switchback procedure is documented
- [x] Config/data compatibility checks are documented
- [x] Operator-visible validation after rollback is documented

## Legacy launch procedure

Legacy rollback target is the root-level `dashboard/` host, not `deck-go/frontend-next/`.

Manual launch:

```bash
cd dashboard
pnpm dev
```

Automated rehearsal:

```bash
cd deck-go
make smoke-stage3-rollback
```

That script:

1. starts `deck-go` backend with a managed gateway token
2. starts the managed gateway and waits for `running/healthy`
3. starts legacy `dashboard/` on port `3000`
4. runs the legacy live smoke specs against that gateway

## Traffic/default switchback procedure

If Stage 3 rollback is required:

1. stop routing operators to `deck-go/frontend`
2. restore the legacy operator entry to `dashboard/`
3. keep the same live Gateway endpoint/token reachable to operators
4. verify the legacy host can bootstrap and load key panels before declaring rollback complete

The rehearsal target for this procedure is `make smoke-stage3-rollback`.

## Config/data compatibility checks

- `dashboard/` uses its own local settings store and writes its own gateway URL/token through
  `/api/onboarding/save-settings`
- rollback rehearsal therefore must prove that the legacy host can reconnect to the current
  managed Gateway without depending on `deck-go/frontend` state
- the rehearsal does **not** assume reuse of Vite-only browser local storage or `deck-go/frontend`
  shell state
- operator-critical runtime truth remains the live Gateway endpoint plus auth token, so rollback
  proof must verify the legacy host can still use those directly

## Operator-visible validation after rollback

Minimum rollback validation is:

1. load the legacy `dashboard/` root successfully
2. bootstrap legacy settings through onboarding save-settings
3. open key operator panels through the legacy host
4. prove the legacy host still talks to the current managed Gateway

The current automated rehearsal covers this through:

- `dashboard/e2e/live-smoke.spec.ts`
- `dashboard/e2e/live-channels-smoke.spec.ts`

Both are executed by `make smoke-stage3-rollback`.
