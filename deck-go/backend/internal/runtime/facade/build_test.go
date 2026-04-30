package facade_test

import (
	"context"
	"path/filepath"
	"testing"

	_ "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	_ "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/remote"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

func TestBuildFacadeSelectsRemote(t *testing.T) {
	rt, err := facade.BuildFacade(&envconf.Loaded{Mode: envconf.ModeRemote}, runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json")))
	if err != nil {
		t.Fatalf("BuildFacade() error = %v", err)
	}
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "remote" {
		t.Fatalf("Mode = %q, want remote", caps.Mode)
	}
}

func TestBuildFacadeSelectsBundled(t *testing.T) {
	rt, err := facade.BuildFacade(&envconf.Loaded{
		Mode:    envconf.ModeBundled,
		Bundled: envconf.RuntimeBundledConfig{Command: "node"},
	}, runtimestate.Open(filepath.Join(t.TempDir(), "deck-state.json")))
	if err != nil {
		t.Fatalf("BuildFacade() error = %v", err)
	}
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "bundled" {
		t.Fatalf("Mode = %q, want bundled", caps.Mode)
	}
}
