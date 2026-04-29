# Gateway Transport Benchmark

Generated during `deck-go-gateway-protocol-mvp` implementation.

Command:

```bash
cd deck-go
make benchmark-rpc
```

Current local evidence:

- `make benchmark-rpc` passed.
- Tests:
  - legacy one-connection-per-request baseline (removed after shared realtime transport landed)
  - `TestRealtimeRequest_P50Below10ms`
- Measured on 2026-04-28:

| Path                         | Behavior                                                                                                         | p50       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| Legacy direct baseline       | 100 loopback `health` RPCs, one websocket connect per RPC                                                        | `0.326ms` |
| `Realtime` shared connection | one warm-up `health` RPC establishes the WebSocket, then 100 loopback `health` RPCs over the existing connection | `0.042ms` |

- Raw command:
  `go test -v -run 'TestRealtimeRequest_P50Below10ms' ./internal/gateway`.
- Pass condition: p50 latency is below 10ms.
