# Parity Matrix

Track every known difference between legacy `dashboard/` and `deck-go/`.

Allowed classifications:

- `must-match`
- `intentional-improvement`
- `legacy-bug-not-carried`
- `deferred`

## Workflow Table

| Workflow                                          | Legacy Surface | deck-go Surface | Status      | Classification | Owner | Notes |
| ------------------------------------------------- | -------------- | --------------- | ----------- | -------------- | ----- | ----- |
| Launch and authenticate operator                  |                |                 | not-started | must-match     |       |       |
| Connect to Gateway and bootstrap capabilities     |                |                 | not-started | must-match     |       |       |
| Load overview/status/inventory                    |                |                 | not-started | must-match     |       |       |
| Load channels/plugins/models inventory            |                |                 | not-started | must-match     |       |       |
| Load and save critical config                     |                |                 | not-started | must-match     |       |       |
| List sessions and open session detail             |                |                 | not-started | must-match     |       |       |
| Send chat message and receive streamed response   |                |                 | not-started | must-match     |       |       |
| Abort active chat/session run                     |                |                 | not-started | must-match     |       |       |
| Recover chat continuity after reconnect/reload    |                |                 | not-started | must-match     |       |       |
| Render tool/result content                        |                |                 | not-started | must-match     |       |       |
| Read logs/basic operator observability            |                |                 | not-started | must-match     |       |       |
| Perform upgrade/restart and restore working state |                |                 | not-started | must-match     |       |       |
