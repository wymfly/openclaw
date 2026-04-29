package gateway

import (
	"testing"

	"go.uber.org/goleak"
)

// TestMain wires goleak.VerifyTestMain so Realtime readers, dispatchers,
// reconnect workers, and typed subscription helpers must shut down in tests.
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(
		m,
		// Test helper that simulates a stalled handshake server via time.Sleep;
		// goleak's IgnoreTopFunction sees the runtime "time.Sleep" so we use
		// IgnoreAnyFunction to match the helper anywhere on the stack.
		goleak.IgnoreAnyFunction("github.com/openclaw/openclaw/deck-go/backend/internal/gateway.newHandshakeStallServer.func2"),
	)
}
