package openclaw

import (
	"testing"

	"go.uber.org/goleak"
)

// TestMain wires goleak.VerifyTestMain to catch goroutine leaks in the
// typed subscription helpers and any future test in this package.
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}
