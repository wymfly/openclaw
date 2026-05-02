# Gateway Alignment Reconciliation

## Related Change

- Existing OpenSpec change: `deck-go-gateway-protocol-full-alignment`
- Current OpenSpec change: `deck-go-end-to-end-contract-chain`

## Boundary

`deck-go-gateway-protocol-full-alignment` owns the Gateway source protocol alignment work:

- generated Gateway Go/TypeScript protocol artifacts
- generated Gateway typed client adoption
- `RequestTyped` transport path
- typed Gateway subscription API
- Gateway coverage and typecheck gates

`deck-go-end-to-end-contract-chain` owns the Deck Go product/BFF contract chain:

- Deck-facing HTTP/SSE DTO source under `deck-go/contracts/source/`
- generated Deck-facing TypeScript and Go DTO artifacts
- endpoint category classification
- documented exceptions for dynamic or upstream-schema-missing leaves
- UI metadata and contract governance for future frontend design

## Integration Rule

Gateway method, result, and event shapes remain upstream-generated Gateway authority. Deck-facing contracts may reference or adapt those shapes but must not hand-redefine Gateway protocol DTOs. When Deck Go exposes an aggregated, redacted, normalized, or control-plane response, the Deck-facing BFF contract is the authority for the browser-facing shape.

## Category Name Reconciliation

The older Gateway alignment proposal used FE classification names:

- `gateway-rpc-proxy`
- `deck-go-bff`
- `binary-stream-upload`

This change normalizes the active machine-readable endpoint classification to the OpenSpec categories:

- `gateway-protocol-adapter`
- `deck-go-bff`
- `stream-binary-upload`
- `documented-exception`

`make gateway-typecheck` now treats only `gateway-protocol-adapter` rows whose migration target starts with `gw.` as frontend string-call violations. Current Deck Go BFF endpoints that adapt Gateway data through the Go service can still be classified without forcing the frontend to bypass Deck Go.

## Shared D12 Exception Set

Both changes agree that the current upstream-schema-missing Gateway methods are:

- `commands.list`
- `exec.approval.list`
- `logs.tail`
- `node.invoke`
- `node.pending.enqueue`
- `plugin.approval.list`
- `tools.catalog`
- `tools.effective`

This change records them in `deck-go/contracts/source/deck-exceptions.contract.json` with owner, reason, and exit criteria. They stay as documented exceptions until upstream schemas or replacement Deck-facing contracts exist.
