## Implementation Notes

Implemented in this pass:

- Canonical service token resolution now prefers `DECK_GO_ACCESS_TOKEN` /
  persisted `accessToken`; legacy Gateway token inputs only seed the canonical
  token when no canonical token exists.
- Settings/bootstrap responses expose token configured/source status without
  returning raw token material; blank token fields preserve existing secrets on
  save.
- Managed Gateway default args no longer include `--force`, and launch args no
  longer receive `--token` / secret-bearing auth flags.
- Gateway auth is provided through `OPENCLAW_GATEWAY_TOKEN`.
- `deck-go` data, settings, managed state, synced config, and ownership metadata
  are written with owner-only POSIX permissions where supported.
- The supervisor persists `deck-go` ownership metadata with state dir, launch
  fingerprint, token hash, and last status on successful launch; it exposes
  non-secret owner/restart state, restarts abnormal owned exits with bounded
  backoff when autostart is enabled, and cleans up the owned process group on
  stop.
- Existing live owned Gateway processes can be adopted after backend restart
  when ownership metadata, PID liveness, launch fingerprint, token hash, state
  dir, and authenticated health probe all match.
- Sustained unhealthy probes replace the owned process, and restart backoff
  resets after a configured stable healthy period.
- `cmd/deck-go` and `cmd/controld` now handle SIGINT/SIGTERM and stop the
  managed Gateway during backend shutdown.
- Local stack defaults now use one canonical token and managed autostart.

Verification performed:

- `go test ./...` from `deck-go/backend`
- `go test ./internal/server ./internal/runtime ./internal/runtime/openclaw ./internal/config` from `deck-go/backend`
- `go test ./internal/server` from `deck-go/backend`
- `node deck-go/contracts/scripts/check-deck-api-generated.mjs`
- `npm run build` from `deck-go/frontend`
- `npm run test:deck-ui -- src/components/panels/settings/SettingsPanel.test.tsx src/components/panels/gateway/GatewayPanel.test.tsx`
- `bash -n deck-go/scripts/manage-local-stack.sh`
- Isolated live stack smoke on backend `127.0.0.1:19666`, frontend
  `127.0.0.1:4274`, and managed Gateway `127.0.0.1:19879`:
  - backend startup auto-started Gateway to `running/healthy`
  - `/api/bootstrap/status` reported `gateway.connected=true`
  - `/api/chat/sessions?agentId=main` returned through the Go backend
  - frontend preview served successfully
  - killing the owned Gateway parent PID `64058` recovered to new PID `78916`
    with `restartAttempts=1`
  - temporary smoke backend/frontend were stopped afterward; the existing
    user stack on `19566/4174/18789` was left untouched
- `deck-go/frontend-next` is intentionally ignored because it is a leftover Next
  migration frontend and not part of the active `deck-go/frontend` surface.

Remaining risks:

- Unowned listener conflict behavior is covered by a focused preflight test.
- Adoption coverage now includes live success plus stale and mismatched metadata
  rejection.
- Unowned listener conflicts surface as `ownershipState=external`; stop refuses
  to terminate them and returns a non-secret status message.
- API and active frontend tests now cover connected, reconnecting/starting,
  degraded, failed, port-conflict, and autostart-disabled managed Gateway
  states.
- Live smoke used isolated ports to avoid disturbing the existing local stack.
