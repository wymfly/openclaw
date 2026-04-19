# Backend

This directory will host the Go local control-plane / BFF for Deck.

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
