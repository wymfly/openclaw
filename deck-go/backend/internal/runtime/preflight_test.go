package runtimecontrol

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

func TestRequiresPreparedRuntime(t *testing.T) {
	if !requiresPreparedRuntime(config.ManagedGatewaySettings{
		Command:    "node",
		Args:       []string{"dist/entry.js", "gateway", "run"},
		WorkingDir: "/repo",
	}) {
		t.Fatal("expected prepared runtime requirement for dist entry launch")
	}
	if requiresPreparedRuntime(config.ManagedGatewaySettings{
		Command: os.Args[0],
		Args:    []string{"-test.run=Helper"},
	}) {
		t.Fatal("did not expect prepared runtime requirement for helper launcher")
	}
	if !requiresPreparedRuntime(config.ManagedGatewaySettings{
		Command:    "/usr/local/bin/node",
		Args:       []string{"dist/entry.js", "gateway", "run"},
		WorkingDir: "/repo",
	}) {
		t.Fatal("expected prepared runtime requirement for absolute node path launch")
	}
}

func TestDefaultPreflight_SkipsWhenPreparedRuntimeReady(t *testing.T) {
	root := makePreparedRuntimeRoot(t)
	cfg := config.ManagedGatewaySettings{
		Command:    "node",
		Args:       []string{"dist/entry.js", "gateway", "run"},
		WorkingDir: root,
	}
	if err := defaultPreflight(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
}

func TestDefaultPreflight_UsesSingleOpenClawOwnedPrepareContract(t *testing.T) {
	root := t.TempDir()
	mustWriteFile(t, filepath.Join(root, "package.json"), "{}")
	mustWriteFile(t, filepath.Join(root, "openclaw.mjs"), "console.log('openclaw')")

	commands := []string{}
	originalRunner := runManagedCommand
	runManagedCommand = func(_ context.Context, workingDir string, name string, args []string, env []string) error {
		commands = append(commands, name+" "+joinArgs(args))
		if workingDir != root {
			t.Fatalf("unexpected working dir: %s", workingDir)
		}
		makePreparedArtifacts(t, root)
		return nil
	}
	defer func() {
		runManagedCommand = originalRunner
	}()

	cfg := config.ManagedGatewaySettings{
		Command:    "node",
		Args:       []string{"dist/entry.js", "gateway", "run"},
		WorkingDir: root,
	}
	if err := defaultPreflight(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
	expected := []string{
		"pnpm build",
		"pnpm ui:build",
	}
	if !reflect.DeepEqual(commands, expected) {
		t.Fatalf("unexpected prepare contract commands: %#v", commands)
	}
}

func makePreparedRuntimeRoot(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	mustWriteFile(t, filepath.Join(root, "package.json"), "{}")
	mustWriteFile(t, filepath.Join(root, "openclaw.mjs"), "console.log('openclaw')")
	makePreparedArtifacts(t, root)
	return root
}

func makePreparedArtifacts(t *testing.T, root string) {
	t.Helper()
	mustWriteFile(t, filepath.Join(root, "dist", "entry.js"), "console.log('entry')")
	mustWriteFile(t, filepath.Join(root, "dist", ".buildstamp"), `{"builtAt":1,"head":"test-head"}`)
	mustWriteFile(t, filepath.Join(root, "dist", "control-ui", "index.html"), "<html></html>")
}

func mustWriteFile(t *testing.T, path string, contents string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
}

func joinArgs(args []string) string {
	return strings.Join(args, " ")
}
