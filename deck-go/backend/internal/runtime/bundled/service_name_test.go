package bundled

import (
	"strings"
	"testing"
)

func TestDeriveServiceName_PrefixAndHashLength(t *testing.T) {
	name := DeriveServiceName("/home/user/work/openclaw-fork-a")
	if !strings.HasPrefix(name, "openclaw-gateway.") {
		t.Fatalf("expected prefix %q, got %q", "openclaw-gateway.", name)
	}
	suffix := strings.TrimPrefix(name, "openclaw-gateway.")
	if len(suffix) != 12 {
		t.Fatalf("expected 12-hex suffix, got %d chars: %q", len(suffix), suffix)
	}
	for _, r := range suffix {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')) {
			t.Fatalf("suffix must be lowercase hex, got %q", suffix)
		}
	}
}

func TestDeriveServiceName_DeterministicSamePath(t *testing.T) {
	a := DeriveServiceName("/home/user/work/openclaw-fork-a")
	b := DeriveServiceName("/home/user/work/openclaw-fork-a")
	if a != b {
		t.Fatalf("expected deterministic derivation, got %q vs %q", a, b)
	}
}

func TestDeriveServiceName_DifferentPathsCollisionFree(t *testing.T) {
	a := DeriveServiceName("/home/user/work/openclaw-fork-a")
	b := DeriveServiceName("/home/user/work/openclaw-fork-b")
	if a == b {
		t.Fatalf("expected distinct service names for distinct paths, both got %q", a)
	}
}
