package bundled

import (
	"context"
	"errors"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

func TestBundledFacadeCapabilities(t *testing.T) {
	rt, err := New(&envconf.RuntimeBundledConfig{Command: "node"})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "bundled" || !caps.Configured || caps.EndpointMutable || !caps.SupervisorState {
		t.Fatalf("capabilities = %#v", caps)
	}
}

func TestBundledEndpointUpdateUnsupported(t *testing.T) {
	rt, err := New(&envconf.RuntimeBundledConfig{Command: "node"})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	_, err = rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://gateway.example.test",
		Token:     "token",
		TLSVerify: true,
	})
	if !errors.Is(err, facade.ErrUnsupported) {
		t.Fatalf("UpdateRemoteEndpoint() error = %v, want ErrUnsupported", err)
	}
}
