# Backend

This directory hosts the current Go control-plane backend for Deck.

Planned responsibilities:

- Gateway capability/bootstrap adapter
- Deck-facing REST API
- Deck-facing SSE stream
- local persistence, projection, and cache
- operator auth/bootstrap
- health and runtime status surfaces

Non-goals:

- redefining Gateway truth
- rendering frontend UI
- future enterprise-platform services

Entrypoints:

- `cmd/deck-go/` — Stage 1 canonical backend entrypoint
- `cmd/controld/` — Stage 2 successor entrypoint alias using the same backend
  handler while the `controld` boundary is being introduced
