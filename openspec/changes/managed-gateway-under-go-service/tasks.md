## 1. Token And Configuration

- [x] 1.1 Add canonical `deck-go` service token resolution in the Go config store, preferring `DECK_GO_ACCESS_TOKEN`, then persisted `accessToken`, then compatible legacy Gateway token inputs.
- [x] 1.2 Update managed Gateway effective settings so Gateway auth defaults to the canonical service token instead of an independent `managedGateway.gatewayToken`.
- [x] 1.3 Add migration tests proving legacy `DECK_GO_GATEWAY_TOKEN` / `managedGateway.gatewayToken` seed the canonical token only when no canonical token exists.
- [x] 1.4 Update API/bootstrap/settings DTOs to report token configured/source status without returning raw token values.

## 2. Secure Persistence

- [x] 2.1 Change `deck-go` data directory and settings persistence to owner-only permissions where supported.
- [x] 2.2 Change managed Gateway state directory and token-bearing generated config files to owner-only permissions where supported.
- [x] 2.3 Add tests asserting settings and managed state files containing token material are written with secure permissions on POSIX platforms.
- [x] 2.4 Ensure logs, runtime status, and events never include raw canonical token values.

## 3. Gateway Launch Safety

- [x] 3.1 Remove `--force` from default managed Gateway arguments.
- [x] 3.2 Stop appending `--token` / secret-bearing auth args in `launchArgs`; pass the canonical token through `OPENCLAW_GATEWAY_TOKEN` or protected config only.
- [x] 3.3 Add pre-start target-port inspection that distinguishes free port, adoptable owned Gateway, and unowned listener conflict.
- [x] 3.4 Add tests proving an unowned listener blocks startup without being killed.

## 4. Ownership Metadata

- [x] 4.1 Define managed Gateway ownership metadata schema with owner ID, PID, bind host/port, state dir, launch fingerprint, token hash, startedAt, and last status.
- [x] 4.2 Persist metadata atomically on successful Gateway launch and update it on health, exit, restart, and stop transitions.
- [x] 4.3 Validate metadata before adoption using PID liveness, launch fingerprint, state dir, and authenticated Gateway health.
- [x] 4.4 Ignore stale metadata safely when PID is dead, process identity mismatches, or authenticated probe fails.
- [x] 4.5 Add unit tests for metadata write/read, adoption success, stale metadata, and mismatch rejection.

## 5. Supervisor Recovery

- [x] 5.1 Add bounded exponential backoff restart policy for abnormal owned Gateway exits while autostart is enabled.
- [x] 5.2 Add sustained-unhealthy probe recovery that marks degraded/restarting before replacing the owned Gateway.
- [x] 5.3 Reset restart backoff after the Gateway remains healthy for a configured stability period.
- [x] 5.4 Ensure static validation/preflight errors mark runtime failed without endless retries.
- [x] 5.5 Add supervisor tests for abnormal exit restart, unhealthy restart, backoff reset, retry exhaustion, and static-failure no-retry.

## 6. Runtime API And Frontend Status

- [x] 6.1 Extend runtime Gateway status payload with ownership/adoption state, restart attempt count, next retry time, last exit details, and non-secret failure phase/message.
- [x] 6.2 Update bootstrap status to derive connected/degraded/failed state from the Go-owned managed runtime connection.
- [x] 6.3 Update frontend runtime/header/chat status copy only as needed to reflect Go-managed Gateway states without introducing direct Gateway control.
- [x] 6.4 Add API/frontend tests covering connected, reconnecting, degraded, failed, port-conflict, and autostart-disabled states.

## 7. Shutdown Semantics

- [x] 7.1 Wire backend shutdown handling so intentional Go service shutdown gracefully stops only the owned Gateway process.
- [x] 7.2 Ensure stop/restart APIs refuse to terminate unowned listeners and return clear non-secret status.
- [x] 7.3 Add tests for owned shutdown, unowned listener stop refusal, and force-kill escalation limited to owned PID.

## 8. Local Stack And Documentation

- [x] 8.1 Update `deck-go/.env.example` to use one canonical token and default managed autostart.
- [x] 8.2 Update `deck-go/scripts/manage-local-stack.sh` to stop exporting separate Deck/Gateway tokens in the normal path.
- [x] 8.3 Update stack smoke scripts to verify backend startup brings Gateway healthy without a separate runtime-start command.
- [x] 8.4 Document that official `openclaw gateway install/start/restart/status` remains the standalone Gateway service path, while `deck-go` default mode is Go-owned Gateway.

## 9. Verification

- [x] 9.1 Run focused Go tests for config, access, runtime supervisor, runtime/openclaw lifecycle, and server runtime APIs.
- [x] 9.2 Run focused frontend tests for runtime status/auth display changes.
- [x] 9.3 Run `deck-go` local stack smoke verifying Go backend + frontend + managed Gateway startup, chat/bootstrap connectivity, and Gateway crash recovery.
- [x] 9.4 Run repository-required checks for touched surfaces, including generated/protocol checks only if protocol DTO generation changes.
- [x] 9.5 Record final verification evidence and remaining operational risks in implementation notes before closing the change.
