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

This directory is intentionally bootstrap-only at phase 0. Feature work starts after the
contract inventory and backbone extraction phases.
