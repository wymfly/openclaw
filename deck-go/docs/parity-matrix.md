# Parity Matrix

Track every known difference between legacy `dashboard/` and `deck-go/`.

Allowed classifications:

- `must-match`
- `intentional-improvement`
- `legacy-bug-not-carried`
- `deferred`

## Workflow Table

| Workflow                                          | Legacy Surface | deck-go Surface          | Status        | Classification | Owner | Notes                                                                                                                                                                                                                                |
| ------------------------------------------------- | -------------- | ------------------------ | ------------- | -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Launch and authenticate operator                  |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke now exercises a configured Deck access-token path, but not the prompt UX or failure recovery path.                                                                                                                             |
| Connect to Gateway and bootstrap capabilities     |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Default smoke proves `/api/runtime/gateway` and `/api/bootstrap/status`; richer smoke with `DECK_GO_SMOKE_GATEWAY_TOKEN` proves lifecycle start acceptance and waits until the managed runtime is `running/healthy`.                 |
| Load overview/status/inventory                    |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Browser smoke hydrates the restored shell and verifies core host chrome plus navigation into `Agents`, `Gateway`, `Logs`, `Models`, `Config`, `Sessions`, and `Plugins`.                                                             |
| Load channels/plugins/models inventory            |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Browser smoke navigates into `Channels`, `Plugins`, and `Models`; default smoke proves route wiring and richer smoke upgrades those inventory/config routes to `200` data proof after the managed runtime reaches `running/healthy`. |
| Load and save critical config                     |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke proves browser navigation into `Config`; richer smoke upgrades `config` / `models config` route proof to `200` after runtime health turns green, but save mutations are still not automated.                                   |
| List sessions and open session detail             |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Browser smoke navigates into `Sessions` and requires both `Session inventory` and `Session detail` panel titles to render; richer smoke also upgrades `/api/sessions` to `200` after runtime health turns green.                     |
| Send chat message and receive streamed response   |                |                          | not-started   | must-match     |       |                                                                                                                                                                                                                                      |
| Abort active chat/session run                     |                |                          | not-started   | must-match     |       |                                                                                                                                                                                                                                      |
| Recover chat continuity after reconnect/reload    |                |                          | not-started   | must-match     |       |                                                                                                                                                                                                                                      |
| Render tool/result content                        |                |                          | not-started   | must-match     |       |                                                                                                                                                                                                                                      |
| Read logs/basic operator observability            |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke proves browser navigation into both `Gateway` and `Logs`; richer smoke upgrades `/api/logs` to `200` after managed runtime health turns green, but not richer observability interaction.                                       |
| Perform upgrade/restart and restore working state |                |                          | not-started   | must-match     |       |                                                                                                                                                                                                                                      |
