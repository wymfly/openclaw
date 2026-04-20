package server

import (
	"fmt"
	"strings"
	"testing"
)

func mustPort(t *testing.T, serverURL string) int {
	t.Helper()
	value := strings.TrimPrefix(serverURL, "http://127.0.0.1:")
	var port int
	if _, err := fmt.Sscanf(value, "%d", &port); err != nil {
		t.Fatalf("failed to parse port from %q: %v", serverURL, err)
	}
	return port
}
