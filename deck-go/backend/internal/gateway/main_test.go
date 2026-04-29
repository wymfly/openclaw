package gateway

import (
	"testing"

	"go.uber.org/goleak"
)

// TestMain wires goleak.VerifyTestMain so Realtime readers, dispatchers,
// reconnect workers, and typed subscription helpers must shut down in tests.
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}
