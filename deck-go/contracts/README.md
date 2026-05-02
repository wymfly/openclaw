# Contracts

This directory owns migration-time and runtime contracts for `deck-go/`.

Subdomains:

- `gateway/` — exported Gateway authority bundle consumed by the new stack
- `source/` — source contracts owned by Deck Go
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

## Authority chain

Deck Go uses layered contract authorities:

1. OpenClaw Gateway source schemas and method/event metadata are the authority
   for Gateway request, result, and event shapes.
2. `contracts/generated/ts/gateway/` and
   `backend/internal/gateway/generated/` are generated Gateway protocol
   artifacts. Do not hand-edit them.
3. `contracts/source/deck-api.contract.ts` is the Deck-facing BFF DTO source.
   It generates `contracts/generated/ts/deck-api.generated.ts` and
   `backend/internal/deckapi/types.generated.go`.
4. `contracts/source/deck-endpoints.contract.json` classifies browser-facing
   Deck Go endpoints as `gateway-protocol-adapter`, `deck-go-bff`,
   `stream-binary-upload`, or `documented-exception`.
5. `contracts/source/deck-exceptions.contract.json` records active dynamic or
   upstream-schema-missing exceptions with owner, reason, and exit criteria.
6. `contracts/source/deck-streams.contract.json` documents SSE stream event
   payloads and temporary dynamic stream leaves while DTO generation is staged.
7. `contracts/source/deck-ui.contract.json` stores UI metadata for generated
   DTO fields, endpoints, actions, safety, refresh behavior, and empty states.
   It generates `contracts/generated/ts/deck-ui-metadata.generated.ts`.

Frontend-local `DeckGo*` DTOs are migration shims, not source authority. New
stable Deck-facing DTOs must be added to `deck-api.contract.ts` first.

## Frontend consumption guide

This section is a navigation aid for frontend work, not a separate source of
truth. If this README disagrees with the source contracts, generated artifacts,
backend adapters, frontend API code, or contract check output, the code truth
wins. Update this README after verifying the actual implementation.

For normal UI development, start with:

- `frontend/src/api-types.ts` — frontend `DeckGo*` type facade. Prefer these
  exports over importing generated DTOs directly from panel code.
- `frontend/src/api.ts` — Deck Go API request functions. UI components should
  call these wrappers instead of scattering endpoint strings.
- `contracts/source/deck-ui.contract.json` — UI metadata source for fields,
  labels, tables, actions, status semantics, safety, refresh behavior, and empty
  states.
- `contracts/generated/ts/deck-ui-metadata.generated.ts` — generated frontend
  metadata artifact. Do not hand-edit it.

When the UI needs contract changes, use:

- `contracts/source/deck-api.contract.ts` — add or change stable Deck-facing
  DTOs here first, then regenerate.
- `contracts/source/deck-endpoints.contract.json` — classify new or tightened
  browser-facing endpoints before relying on them from UI code.
- `contracts/source/deck-streams.contract.json` — document SSE stream payloads
  that are not fully generated DTOs yet.
- `contracts/source/deck-exceptions.contract.json` and
  `docs/gateway-untyped-exceptions.md` — inspect remaining dynamic or
  upstream-schema-missing surfaces before building UI assumptions around them.

## Contract commands

Run these from `deck-go/`:

```bash
make contracts-sync                  # regenerate Deck-facing TS + Go DTOs
make contracts-check                 # check Deck-facing generated artifacts
make endpoint-classification-sync    # regenerate endpoint classification docs
make endpoint-classification-check   # check endpoint classification docs
make contract-exceptions-sync        # regenerate exception docs
make contract-exceptions-check       # check exception docs
make stream-contract-sync            # regenerate stream contract docs
make stream-contract-check           # check stream contract docs
make ui-metadata-sync                # regenerate UI metadata TS + docs
make ui-metadata-check               # validate UI metadata references and drift
make ui-metadata-test                # run stale-reference validator assertions
make contract-inventory              # write contract inventory and gap report
make contract-gate                   # run the current contract governance gate
```

`make gateway-typecheck` also rewrites
`docs/gateway-untyped-exceptions.md` by joining inline allow markers with
`contracts/source/deck-exceptions.contract.json`. A new untyped Gateway call is
accepted only when it has both an inline reason and a registry record.

## Migration rules

- Gateway protocol shapes must be consumed from generated Gateway artifacts when
  upstream schemas exist.
- Deck-facing responses that aggregate, redact, enrich, normalize, or expose
  Deck control-plane behavior must be defined in `deck-api.contract.ts`.
- Browser endpoints must be listed in `deck-endpoints.contract.json` before they
  are migrated or tightened.
- SSE stream payloads must be generated DTOs or explicitly documented in
  `deck-streams.contract.json`.
- UI metadata must reference existing generated DTOs, DTO fields, endpoints, and
  actions. Stale references fail `make ui-metadata-check` and `make contract-gate`.
- Dynamic leaves such as `unknown`, `Record<string, unknown>`, `map[string]any`,
  raw Gateway passthroughs, and temporary frontend DTO shims require an
  exception record with a removal condition.
- Generated files are outputs. Fix the source contract or generator, then rerun
  the corresponding sync target.
