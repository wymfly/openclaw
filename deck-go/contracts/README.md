# Contracts

This directory owns migration-time and runtime contracts for `deck-go/`.

Subdomains:

- `gateway/` — exported Gateway authority bundle consumed by the new stack
- `generated/ts/` — frontend-facing generated client and DTO artifacts
- `generated/go/` — backend-facing generated bindings and DTO artifacts
- `fixtures/legacy/` — captured legacy responses/events used for parity tests

Key rule:

- Gateway protocol is never hand-redefined here if it can be generated from upstream authority.
- Deck-facing API/SSE contracts are defined here once and generated for both TypeScript and Go.
