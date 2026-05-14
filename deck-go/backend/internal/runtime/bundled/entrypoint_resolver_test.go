package bundled

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func writeTestFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestResolveEntrypoint_EnvOverride(t *testing.T) {
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")

	got, err := ResolveEntrypoint(ResolveOptions{RepoRootEnv: repo})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := filepath.Join(repo, "dist", "entry.js")
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestResolveEntrypoint_RelativeFromBFFBinary(t *testing.T) {
	root := t.TempDir()
	bffDir := filepath.Join(root, "deck-go", "backend", "bin")
	if err := os.MkdirAll(bffDir, 0o755); err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, filepath.Join(root, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(root, "dist", "entry.js"), "// stub")

	got, err := ResolveEntrypoint(ResolveOptions{BFFBinaryDir: bffDir})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := filepath.Join(root, "dist", "entry.js")
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestResolveEntrypoint_InstallTimeAbsolutePath(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, filepath.Join(root, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(root, "dist", "entry.js"), "// stub")

	got, err := ResolveEntrypoint(ResolveOptions{
		InstallTimeAbsolutePath: filepath.Join(root, "dist", "entry.js"),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := filepath.Join(root, "dist", "entry.js")
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestResolveEntrypoint_NoneResolveError(t *testing.T) {
	_, err := ResolveEntrypoint(ResolveOptions{})
	if !errors.Is(err, ErrEntrypointNotFound) {
		t.Fatalf("expected ErrEntrypointNotFound, got %v", err)
	}
}

func TestResolveEntrypoint_OutsideRepoRejected(t *testing.T) {
	other := t.TempDir()
	writeTestFile(t, filepath.Join(other, "dist", "entry.js"), "// stub")

	_, err := ResolveEntrypoint(ResolveOptions{RepoRootEnv: other})
	if !errors.Is(err, ErrEntrypointOutsideRepo) {
		t.Fatalf("expected ErrEntrypointOutsideRepo, got %v", err)
	}
}
