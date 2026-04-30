# deck-go Gateway RPC Performance Baseline

Status: baseline harness added; measured production-like numbers must be filled before `DECK_GO_BFF_VIEW_LAYER` defaults to `1`.

## Gates

- Each C3 BFF view P95 <= 60% of upstream fallback P95.
- WS RPC P95 <= 95% of HTTP RPC P95.
- 32-call batch P95 <= 4x single RPC P95.
- Sustained C3 view fallback rate must not exceed 5% for two consecutive 5-minute windows.

## Command

```bash
make -C deck-go benchmark-rpc
go run deck-go/scripts/bench-rpc.go
```

`bench-rpc.go` emits the required JSON cell matrix and environment metadata.
The existing `benchmark-rpc` Make target remains the local regression gate for
checked-in Go benchmark tests.
