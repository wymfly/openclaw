//go:build !windows

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/admin"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type fakeAdminRuntime struct{}

func (fakeAdminRuntime) Capabilities(context.Context) (facade.Capabilities, error) {
	return facade.Capabilities{
		Mode:            "remote",
		Configured:      true,
		EndpointMutable: true,
		SupervisorState: false,
	}, nil
}

func (fakeAdminRuntime) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	lastConnectedAt := "2026-04-28T00:00:00Z"
	return facade.RuntimeStatus{LastConnectedAt: &lastConnectedAt}, nil
}

func (fakeAdminRuntime) Restart(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, nil
}

func (fakeAdminRuntime) ReloadRuntime(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{Mode: "remote"}, nil
}

func TestRunAdminStatusPrintsSocketResponse(t *testing.T) {
	socketPath := shortSocketPath(t, "deck-go-admin.sock")
	server, err := admin.StartSocketServer(context.Background(), admin.SocketOptions{
		Path:    socketPath,
		Runtime: fakeAdminRuntime{},
	})
	if err != nil {
		t.Fatalf("StartSocketServer() error = %v", err)
	}
	defer server.Close()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := runAdminWithIO(context.Background(), []string{"status"}, func(key string) string {
		if key == "RUNTIME_ADMIN_SOCKET" {
			return socketPath
		}
		return ""
	}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("runAdminWithIO status = %d stderr=%s", code, stderr.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(stdout.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["mode"] != "remote" || payload["configured"] != true {
		t.Fatalf("unexpected admin status payload: %#v", payload)
	}
}

func TestRunAdminUsageError(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := runAdminWithIO(context.Background(), nil, func(string) string { return "" }, &stdout, &stderr)
	if code != 2 {
		t.Fatalf("runAdminWithIO missing args code = %d, want 2", code)
	}
	if stdout.Len() != 0 || stderr.Len() == 0 {
		t.Fatalf("unexpected usage output stdout=%q stderr=%q", stdout.String(), stderr.String())
	}
}

func shortSocketPath(t *testing.T, name string) string {
	t.Helper()
	dir, err := os.MkdirTemp("/tmp", "dga-cli-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(dir)
	})
	return filepath.Join(dir, name)
}
