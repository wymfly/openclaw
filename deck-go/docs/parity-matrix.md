# Parity Matrix

Track every known difference between legacy `dashboard/` and `deck-go/`.

Allowed classifications:

- `must-match`
- `intentional-improvement`
- `legacy-bug-not-carried`
- `deferred`

## Workflow Table

| Workflow                                          | Legacy Surface | deck-go Surface          | Status        | Classification | Owner | Notes                                                                                                                                                                    |
| ------------------------------------------------- | -------------- | ------------------------ | ------------- | -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Launch and authenticate operator                  |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke now exercises a configured Deck access-token path, but not the prompt UX or failure recovery path.                                                                 |
| Connect to Gateway and bootstrap capabilities     |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke proves `/api/runtime/gateway` and `/api/bootstrap/status` under the active Vite host.                                                                              |
| Load overview/status/inventory                    |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Browser smoke hydrates the restored shell and verifies core host chrome plus navigation into `Agents`, `Gateway`, `Logs`, `Models`, `Config`, `Sessions`, and `Plugins`. |
| Load channels/plugins/models inventory            |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Browser smoke navigates into `Channels`, `Plugins`, and `Models`; backend route wiring is also checked.                                                                  |
| Load and save critical config                     |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke proves config route wiring and browser navigation into `Config`, but not save mutations yet.                                                                       |
| List sessions and open session detail             |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Browser smoke now navigates into `Sessions` and requires both `Session inventory` and `Session detail` panel titles to render.                                           |
| Send chat message and receive streamed response   |                |                          | not-started   | must-match     |       |                                                                                                                                                                          |
| Abort active chat/session run                     |                |                          | not-started   | must-match     |       |                                                                                                                                                                          |
| Recover chat continuity after reconnect/reload    |                |                          | not-started   | must-match     |       |                                                                                                                                                                          |
| Render tool/result content                        |                |                          | not-started   | must-match     |       |                                                                                                                                                                          |
| Read logs/basic operator observability            |                | `make smoke-stage3-host` | partial-proof | must-match     |       | Smoke proves logs route wiring and browser navigation into both `Gateway` and `Logs`, but not richer observability interaction.                                          |
| Perform upgrade/restart and restore working state |                |                          | not-started   | must-match     |       |                                                                                                                                                                          |
