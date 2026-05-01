# Parity Matrix

Track every known difference between legacy `dashboard/` and `deck-go/`.

Allowed classifications:

- `must-match`
- `intentional-improvement`
- `legacy-bug-not-carried`
- `deferred`

Canonical Codex/Ralph E2E proof now runs through the Codex Playwright plugin
against a foreground `deck-go` backend, foreground Vite preview, and
`manage-local-stack.sh runtime-start` managed source Gateway.

Do not use the shell-launched `make smoke-stage3-host` or
`make smoke-stage3-e2e` path for Codex/Ralph validation. Those Makefile targets
are intentionally disabled because Chrome/Chromium launch from the sandboxed
shell fails with process-control errors.

## Workflow Table

| Workflow                                          | Legacy Surface | deck-go Surface                                         | Status | Classification | Owner | Notes                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | -------------- | ------------------------------------------------------- | ------ | -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launch and authenticate operator                  |                | Codex Playwright plugin E2E                             | green  | must-match     |       | Latest foreground-stack plugin proof pre-seeded the Deck access token in browser storage on frontend `62812`, hydrated the active Vite host built against backend `62811`, and verified the shell exposes `Gateway Healthy` and `Runtime running`.                                                          |
| Connect to Gateway and bootstrap capabilities     |                | Codex Playwright plugin E2E                             | green  | must-match     |       | The foreground backend plus `manage-local-stack.sh runtime-start` path proves the Go backend starts the source Gateway on `18811` and reaches `running/healthy`; plugin-side and shell direct checks for `/api/runtime/gateway` and `/api/bootstrap/status` return 200.                                     |
| Load overview/status/inventory                    |                | Codex Playwright plugin E2E                             | green  | must-match     |       | Latest `62811/62812/18811` plugin proof renders the active shell and high-value panels `Chat`, `Agents`, `Gateway`, `Models`, `Sessions`, `Logs`, `Activity`, `Config`, `Plugins`, and `Settings` with non-empty main content and no visible fetch/auth/token failures.                                     |
| Load channels/plugins/models inventory            |                | Codex Playwright plugin E2E                             | green  | must-match     |       | Plugin and shell direct API checks prove `/api/agents`, `/api/config`, `/api/sessions?agentId=main&limit=5`, `/api/models/usage/providers`, `/api/gateway/health`, `/api/gateway/status`, `/api/usage/sessions?...`, and `/api/deck/commands/discover` all return 200 while the managed Gateway is healthy. |
| Load and save critical config                     |                | Codex Playwright plugin E2E + focused tests             | green  | must-match     |       | Plugin E2E proves the Config and Settings panels render against the live backend; mutation guardrails remain covered by focused deck-ui and backend tests rather than shell browser smoke.                                                                                                                  |
| List sessions and open session detail             |                | Codex Playwright plugin E2E                             | green  | must-match     |       | Plugin E2E proves the Sessions panel renders live inventory/detail content and direct `/api/sessions?agentId=main&limit=5` returns 200.                                                                                                                                                                     |
| Send chat message and receive streamed response   |                | Codex Playwright plugin E2E                             | green  | must-match     |       | Latest foreground-stack plugin proof used real keyboard input in the Chat composer, pressed Enter, observed `/api/chat/send` return 200, and rendered `959595 -> 959596`; console capture reported 0 errors and 0 warnings. Historical 62611/62612 artifacts remain valid earlier evidence.                 |
| Abort active chat/session run                     |                | Backend/API tests + plugin Chat E2E                     | green  | must-match     |       | Chat send/session lifecycle stays covered by backend server tests and plugin E2E; shell-launched smoke is no longer used as the browser proof.                                                                                                                                                              |
| Recover chat continuity after reconnect/reload    |                | Backend/API tests + plugin reload follow-up             | green  | must-match     |       | Continuity assertions should be exercised with the Codex Playwright plugin when needed; do not use the shell `smoke-stage3-browser.mjs` lane.                                                                                                                                                               |
| Render tool/result content                        |                | `npm run test:deck-ui` + Codex Playwright plugin E2E    | green  | must-match     |       | Active transcript rendering has deterministic frontend regressions, and plugin E2E now owns the browser-backed Chat proof.                                                                                                                                                                                  |
| Read logs/basic operator observability            |                | Codex Playwright plugin E2E                             | green  | must-match     |       | Plugin E2E proves Gateway and Logs panels render while runtime is healthy, with direct API checks returning 200.                                                                                                                                                                                            |
| Perform upgrade/restart and restore working state |                | `manage-local-stack.sh runtime-start/stop` + plugin E2E | green  | must-match     |       | Runtime lifecycle is proved through the Go backend's stack manager plus plugin-visible `Gateway Healthy` / `Runtime running`; shell browser smoke is not part of the gate.                                                                                                                                  |
