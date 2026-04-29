//go:build !windows

package admin

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

func TestStartSocketServerServesStatus(t *testing.T) {
	path := shortSocketPath(t, "admin.sock")
	lastConnectedAt := "2026-04-28T00:00:00Z"
	runtime := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		status: facade.RuntimeStatus{LastConnectedAt: &lastConnectedAt},
	}
	server, err := StartSocketServer(context.Background(), SocketOptions{
		Path:    path,
		Runtime: runtime,
	})
	if err != nil {
		t.Fatalf("StartSocketServer() error = %v", err)
	}
	defer server.Close()

	conn, err := net.Dial("unix", path)
	if err != nil {
		t.Fatalf("dial admin socket: %v", err)
	}
	defer conn.Close()
	if _, err := conn.Write([]byte("status\n")); err != nil {
		t.Fatal(err)
	}
	line, err := bufio.NewReader(conn).ReadBytes('\n')
	if err != nil {
		t.Fatal(err)
	}
	var payload map[string]any
	if err := json.Unmarshal(line, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["mode"] != "remote" || payload["configured"] != true || payload["lastConnectedAt"] != lastConnectedAt {
		t.Fatalf("unexpected status payload: %#v", payload)
	}

	assertMode(t, filepath.Dir(path), 0o700)
	assertMode(t, path, 0o600)
}

func TestStartSocketServerUsesGroupModeWhenGroupResolves(t *testing.T) {
	path := shortSocketPath(t, "admin.sock")
	server, err := StartSocketServer(context.Background(), SocketOptions{
		Path:    path,
		Group:   "deck-admin",
		Runtime: &fakeRuntimeFacade{},
		ResolveGroup: func(string) (int, bool, error) {
			return os.Getgid(), true, nil
		},
	})
	if err != nil {
		t.Fatalf("StartSocketServer() error = %v", err)
	}
	defer server.Close()

	assertMode(t, path, 0o660)
}

func TestStartSocketServerFallsBackToOwnerOnlyWhenGroupDoesNotResolve(t *testing.T) {
	path := shortSocketPath(t, "admin.sock")
	server, err := StartSocketServer(context.Background(), SocketOptions{
		Path:    path,
		Group:   "missing-group",
		Runtime: &fakeRuntimeFacade{},
		ResolveGroup: func(string) (int, bool, error) {
			return 0, false, nil
		},
	})
	if err != nil {
		t.Fatalf("StartSocketServer() error = %v", err)
	}
	defer server.Close()

	assertMode(t, path, 0o600)
}

func TestSocketStatusDoesNotReloadRuntime(t *testing.T) {
	path := shortSocketPath(t, "admin.sock")
	lastError := "previous failure"
	runtime := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		status: facade.RuntimeStatus{LastError: &lastError},
	}
	server, err := StartSocketServer(context.Background(), SocketOptions{
		Path:    path,
		Runtime: runtime,
	})
	if err != nil {
		t.Fatalf("StartSocketServer() error = %v", err)
	}
	defer server.Close()

	raw, err := Request(context.Background(), path, VerbStatus)
	if err != nil {
		t.Fatalf("Request(status) error = %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["lastError"] != lastError {
		t.Fatalf("unexpected status payload: %#v", payload)
	}
	if runtime.reloadCalls != 0 {
		t.Fatalf("status request called ReloadRuntime %d times", runtime.reloadCalls)
	}
	if runtime.statusCalls != 1 {
		t.Fatalf("status request called RuntimeGatewayStatus %d times, want 1", runtime.statusCalls)
	}
}

func TestStartSocketServerRefusesToReplaceNonSocketPath(t *testing.T) {
	path := shortSocketPath(t, "admin.sock")
	if err := os.WriteFile(path, []byte("not a socket"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := StartSocketServer(context.Background(), SocketOptions{
		Path:    path,
		Runtime: &fakeRuntimeFacade{},
	})
	if err == nil {
		t.Fatal("StartSocketServer() error = nil, want non-socket path refusal")
	}
}

func shortSocketPath(t *testing.T, name string) string {
	t.Helper()
	dir, err := os.MkdirTemp("/tmp", "dga-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(dir)
	})
	return filepath.Join(dir, name)
}

func assertMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != want {
		t.Fatalf("%s mode = %04o, want %04o", path, got, want)
	}
}
