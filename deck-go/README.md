# deck-go

Parallel Deck migration project.

Goals for phase 0:

- keep the legacy `dashboard/` runnable and untouched except for critical fixes
- establish a sibling project for the Go-backed control-plane migration
- preserve a single React frontend product
- preserve chat inside that frontend product
- create the documentation and contract locations required by the approved PRD

Directory map:

- `backend/` — Go control-plane / BFF
- `frontend/` — React SPA
- `contracts/` — generated and owned contract artifacts
- `docs/` — parity, cutover, governance, and deployment evidence
- `dev/` — local side-by-side development helpers

Local Stage 3 operator stack:

- copy `deck-go/.env.example` to `deck-go/.env`
- `cd deck-go && make stack-start`
- `cd deck-go && make stack-chat-smoke`

That stack uses:

- `backend/` as the control-plane truth
- `frontend/` as the active Vite host
- `deck-go` backend managed runtime APIs to own the local Gateway lifecycle
- `stack-chat-smoke` as the focused browser proof that the live frontend can unlock,
  send a chat message, and render the assistant reply through the active host
