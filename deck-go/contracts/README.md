# Contracts

This directory owns migration-time and runtime contracts for `deck-go/`.

Subdomains:

- `gateway/` — exported Gateway authority bundle consumed by the new stack
- `generated/ts/` — frontend-facing generated client and DTO artifacts
- `generated/ts/gateway/` — generated Gateway typed client and protocol DTOs
- `fixtures/legacy/` — captured legacy responses/events used for parity tests

Key rule:

- Gateway protocol is never hand-redefined here if it can be generated from upstream authority.
- Deck-facing API/SSE contracts are defined here once and generated for both TypeScript and Go.

Gateway protocol generation:

```bash
cd deck-go
make protocol-update   # regenerate TS + Go Gateway artifacts
make protocol-check    # verify generated artifacts without writing files
```

The Gateway Go artifacts are generated inside the backend module at
`backend/internal/gateway/generated/` so `go test ./...` can build them without a
new `go.mod` or `go.work` boundary.
