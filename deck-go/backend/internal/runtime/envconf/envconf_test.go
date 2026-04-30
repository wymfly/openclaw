package envconf

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadRequiresRuntimeMode(t *testing.T) {
	_, err := Load(Options{Environ: []string{}})
	if err == nil || !strings.Contains(err.Error(), "RUNTIME_MODE") {
		t.Fatalf("expected missing RUNTIME_MODE error, got %v", err)
	}
	if !strings.Contains(err.Error(), ".env.bundled.example") || !strings.Contains(err.Error(), ".env.remote.example") {
		t.Fatalf("missing RUNTIME_MODE error should point to env examples, got %v", err)
	}
	var usageErr *UsageError
	if !errors.As(err, &usageErr) || ExitCode(err) != 64 {
		t.Fatalf("expected usage error with exit 64, got %T / %d", err, ExitCode(err))
	}
}

func TestLoadRejectsInvalidRuntimeMode(t *testing.T) {
	_, err := Load(Options{Environ: []string{"RUNTIME_MODE=local"}})
	if err == nil || !strings.Contains(err.Error(), "bundled") || !strings.Contains(err.Error(), "remote") {
		t.Fatalf("expected invalid mode error listing accepted values, got %v", err)
	}
}

func TestLoadBundledRequiresCommand(t *testing.T) {
	_, err := Load(Options{Environ: []string{"RUNTIME_MODE=bundled"}})
	if err == nil || !strings.Contains(err.Error(), "RUNTIME_BUNDLED_COMMAND") {
		t.Fatalf("expected missing bundled command error, got %v", err)
	}
}

func TestLoadBundledParsesRuntimeEnv(t *testing.T) {
	loaded, err := Load(Options{Environ: []string{
		"RUNTIME_MODE=bundled",
		"RUNTIME_BUNDLED_COMMAND=node",
		"RUNTIME_BUNDLED_ARGS=dist/entry.js gateway run",
		"RUNTIME_BUNDLED_WORKDIR=/opt/openclaw",
		"RUNTIME_BUNDLED_BIND_HOST=127.0.0.1",
		"RUNTIME_BUNDLED_BIND_PORT=18789",
		"RUNTIME_BUNDLED_TOKEN=dev-token",
		"RUNTIME_BUNDLED_AUTO_START=false",
		"RUNTIME_BUNDLED_ENV_NO_PROXY=localhost,127.0.0.1",
	}})
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.Mode != ModeBundled {
		t.Fatalf("Mode = %q, want %q", loaded.Mode, ModeBundled)
	}
	if loaded.Bundled.Command != "node" {
		t.Fatalf("Command = %q", loaded.Bundled.Command)
	}
	if got := strings.Join(loaded.Bundled.Args, " "); got != "dist/entry.js gateway run" {
		t.Fatalf("Args = %q", got)
	}
	if loaded.Bundled.BindPort != 18789 {
		t.Fatalf("BindPort = %d", loaded.Bundled.BindPort)
	}
	if loaded.Bundled.AutoStart {
		t.Fatal("AutoStart = true, want false")
	}
	if loaded.Bundled.Env["NO_PROXY"] != "localhost,127.0.0.1" {
		t.Fatalf("forwarded env = %#v", loaded.Bundled.Env)
	}
}

func TestLoadBundledRejectsDeniedRuntimeEnv(t *testing.T) {
	_, err := Load(Options{Environ: []string{
		"RUNTIME_MODE=bundled",
		"RUNTIME_BUNDLED_COMMAND=node",
		"RUNTIME_BUNDLED_ENV_LD_PRELOAD=evil.dylib",
	}})
	if err == nil || !strings.Contains(err.Error(), "LD_PRELOAD") {
		t.Fatalf("expected denied env error naming LD_PRELOAD, got %v", err)
	}
	if ExitCode(err) != 64 {
		t.Fatalf("ExitCode() = %d, want 64", ExitCode(err))
	}
}

func TestLoadBundledRejectsDyldAndOperatorDeniedRuntimeEnv(t *testing.T) {
	for _, tc := range []struct {
		name    string
		env     []string
		wantKey string
	}{
		{
			name: "dyld",
			env: []string{
				"RUNTIME_MODE=bundled",
				"RUNTIME_BUNDLED_COMMAND=node",
				"RUNTIME_BUNDLED_ENV_DYLD_INSERT_LIBRARIES=evil.dylib",
			},
			wantKey: "DYLD_INSERT_LIBRARIES",
		},
		{
			name: "operator deny",
			env: []string{
				"RUNTIME_MODE=bundled",
				"RUNTIME_BUNDLED_COMMAND=node",
				"RUNTIME_BUNDLED_ENV_DENY=FOO,BAR",
				"RUNTIME_BUNDLED_ENV_BAR=blocked",
			},
			wantKey: "BAR",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Load(Options{Environ: tc.env})
			if err == nil || !strings.Contains(err.Error(), tc.wantKey) {
				t.Fatalf("expected denied env error naming %s, got %v", tc.wantKey, err)
			}
			if ExitCode(err) != 64 {
				t.Fatalf("ExitCode() = %d, want 64", ExitCode(err))
			}
		})
	}
}

func TestLoadRemoteAllowsFirstRunDefaults(t *testing.T) {
	loaded, err := Load(Options{Environ: []string{"RUNTIME_MODE=remote"}})
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.Mode != ModeRemote {
		t.Fatalf("Mode = %q, want %q", loaded.Mode, ModeRemote)
	}
	if loaded.Remote.URL != "" {
		t.Fatalf("Remote.URL = %q, want empty", loaded.Remote.URL)
	}
	if !loaded.Remote.TLSVerify {
		t.Fatal("Remote.TLSVerify = false, want default true")
	}
}

func TestLoadRemoteRejectsInvalidURLSchemes(t *testing.T) {
	for _, rawURL := range []string{
		"file:///tmp/gateway.sock",
		"unix:///tmp/gateway.sock",
		"ftp://gateway.example.test",
		"gopher://gateway.example.test",
		"://missing-scheme",
	} {
		t.Run(rawURL, func(t *testing.T) {
			_, err := Load(Options{Environ: []string{
				"RUNTIME_MODE=remote",
				"RUNTIME_REMOTE_URL=" + rawURL,
			}})
			if err == nil || !strings.Contains(err.Error(), "http or https") {
				t.Fatalf("expected invalid URL error, got %v", err)
			}
			if ExitCode(err) != 64 {
				t.Fatalf("ExitCode() = %d, want 64", ExitCode(err))
			}
		})
	}
}

func TestLoadDotenvFileUsesFileAsFallbackAndUnquotesValues(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env.dev")
	body := strings.Join([]string{
		`RUNTIME_MODE=remote`,
		`RUNTIME_REMOTE_URL="https://gateway.example.test"`,
		`RUNTIME_REMOTE_TOKEN='file-token'`,
		`RUNTIME_REMOTE_TLS_VERIFY=false`,
		`RUNTIME_BUNDLED_COMMAND=node`,
	}, "\n")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}

	var logs []string
	loaded, err := Load(Options{
		Environ: []string{
			"DECK_DOTENV_FILE=" + path,
			"RUNTIME_REMOTE_TOKEN=process-token",
		},
		Logf: func(format string, args ...any) {
			logs = append(logs, format)
		},
	})
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.Mode != ModeRemote {
		t.Fatalf("Mode = %q", loaded.Mode)
	}
	if loaded.Remote.URL != "https://gateway.example.test" {
		t.Fatalf("Remote.URL = %q", loaded.Remote.URL)
	}
	if loaded.Remote.Token != "process-token" {
		t.Fatalf("Remote.Token = %q, want process env to win", loaded.Remote.Token)
	}
	if len(logs) == 0 || !strings.Contains(logs[0], "process env overrides dotenv") {
		t.Fatalf("expected process-env-wins log, got %#v", logs)
	}
	if loaded.Remote.TLSVerify {
		t.Fatal("Remote.TLSVerify = true, want false from dotenv")
	}
}

func TestLoadDotenvFileRejectsLoosePermissions(t *testing.T) {
	if os.Getenv("GOOS") == "windows" {
		t.Skip("POSIX permission test")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, ".env.dev")
	if err := os.WriteFile(path, []byte("RUNTIME_MODE=remote\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := Load(Options{Environ: []string{"DECK_DOTENV_FILE=" + path}})
	if err == nil || !strings.Contains(err.Error(), "permissions") {
		t.Fatalf("expected dotenv permissions error, got %v", err)
	}
}
