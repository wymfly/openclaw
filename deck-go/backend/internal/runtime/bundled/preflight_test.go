package bundled

import (
	"context"
	"net"
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
		command := name + " " + joinArgs(args)
		commands = append(commands, command)
		if workingDir != root {
			t.Fatalf("unexpected working dir: %s", workingDir)
		}
		switch command {
		case "pnpm build":
			mustWriteFile(t, filepath.Join(root, "dist", "entry.js"), "console.log('entry')")
			mustWriteFile(t, filepath.Join(root, "dist", ".buildstamp"), `{"builtAt":1,"head":"build-head"}`)
		case "pnpm ui:build":
			mustWriteFile(t, filepath.Join(root, "dist", "control-ui", "index.html"), "<html></html>")
			if err := os.Remove(filepath.Join(root, "dist", ".buildstamp")); err != nil && !os.IsNotExist(err) {
				t.Fatal(err)
			}
		case "node scripts/build-stamp.mjs":
			mustWriteFile(t, filepath.Join(root, "dist", ".buildstamp"), `{"builtAt":2,"head":"ui-head"}`)
		default:
			t.Fatalf("unexpected command: %s", command)
		}
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
		"node scripts/build-stamp.mjs",
	}
	if !reflect.DeepEqual(commands, expected) {
		t.Fatalf("unexpected prepare contract commands: %#v", commands)
	}
}

func TestDefaultPreflight_UnownedListenerBlocksPreparedGatewayWithoutKillingIt(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	port := listener.Addr().(*net.TCPAddr).Port

	err = defaultPreflight(context.Background(), config.ManagedGatewaySettings{
		Command:    "node",
		Args:       []string{"dist/entry.js", "gateway", "run"},
		WorkingDir: t.TempDir(),
		BindHost:   "127.0.0.1",
		BindPort:   port,
	})
	if err == nil {
		t.Fatal("expected occupied port to block prepared gateway startup")
	}
	if _, err := net.Listen("tcp", listener.Addr().String()); err == nil {
		t.Fatal("expected original unowned listener to remain alive")
	}
}

func TestManagedEnvAddsLocalProxyAndWritableNpmCache(t *testing.T) {
	t.Setenv("NPM_CONFIG_CACHE", "")
	t.Setenv("npm_config_cache", "")

	env := managedEnv(config.ManagedGatewaySettings{GatewayToken: "gateway-token"})
	values := envMap(env)

	expectedCache := filepath.Join(os.TempDir(), "deck-go-npm-cache")
	if values["NPM_CONFIG_CACHE"] != expectedCache {
		t.Fatalf("unexpected NPM_CONFIG_CACHE: %q", values["NPM_CONFIG_CACHE"])
	}
	if values["npm_config_cache"] != expectedCache {
		t.Fatalf("unexpected npm_config_cache: %q", values["npm_config_cache"])
	}
	if values["NO_PROXY"] != "localhost,127.0.0.1,::1" {
		t.Fatalf("unexpected NO_PROXY: %q", values["NO_PROXY"])
	}
	if values["no_proxy"] != "localhost,127.0.0.1,::1" {
		t.Fatalf("unexpected no_proxy: %q", values["no_proxy"])
	}
	if values["OPENCLAW_GATEWAY_TOKEN"] != "gateway-token" {
		t.Fatalf("unexpected gateway token: %q", values["OPENCLAW_GATEWAY_TOKEN"])
	}
}

func TestManagedEnvPreservesExplicitNpmCache(t *testing.T) {
	t.Setenv("NPM_CONFIG_CACHE", "")
	t.Setenv("npm_config_cache", "")

	env := managedEnv(config.ManagedGatewaySettings{
		GatewayToken: "gateway-token",
		Env: map[string]string{
			"NPM_CONFIG_CACHE": "/custom/npm-cache",
		},
	})
	values := envMap(env)

	if values["NPM_CONFIG_CACHE"] != "/custom/npm-cache" {
		t.Fatalf("unexpected explicit NPM_CONFIG_CACHE: %q", values["NPM_CONFIG_CACHE"])
	}
	if _, ok := values["npm_config_cache"]; ok {
		t.Fatalf("did not expect lowercase npm cache fallback when explicit cache is configured")
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

func envMap(env []string) map[string]string {
	values := map[string]string{}
	for _, entry := range env {
		key, value, ok := strings.Cut(entry, "=")
		if ok {
			values[key] = value
		}
	}
	return values
}
