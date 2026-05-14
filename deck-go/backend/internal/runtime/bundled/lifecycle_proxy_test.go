package bundled

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeExec struct {
	calls []ExecCall
	err   error
}

func (f *fakeExec) Run(_ context.Context, call ExecCall) ([]byte, error) {
	f.calls = append(f.calls, call)
	return nil, f.err
}

func newProxy(exec *fakeExec) *LifecycleProxy {
	return &LifecycleProxy{
		ServiceName:    "openclaw-gateway.abc123def456",
		EntrypointPath: "/abs/repo/dist/entry.js",
		Exec:           exec,
	}
}

func TestLifecycleProxy_InstallShellsOutWithEnvVars(t *testing.T) {
	exec := &fakeExec{}
	p := newProxy(exec)
	if _, err := p.Install(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(exec.calls) != 1 {
		t.Fatalf("expected 1 exec call, got %d", len(exec.calls))
	}
	call := exec.calls[0]
	if call.Command != "node" {
		t.Fatalf("expected command=node, got %q", call.Command)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "install"}
	if !equalSlices(call.Args, wantArgs) {
		t.Fatalf("expected args=%v, got %v", wantArgs, call.Args)
	}
	mustHaveEnv(t, call, "OPENCLAW_LAUNCHD_LABEL", "openclaw-gateway.abc123def456")
	mustHaveEnv(t, call, "OPENCLAW_SYSTEMD_UNIT", "openclaw-gateway.abc123def456")
	mustHaveEnv(t, call, "OPENCLAW_WINDOWS_TASK_NAME", "openclaw-gateway.abc123def456")
	for _, arg := range call.Args {
		if arg == "--service-name" || arg == "--entrypoint" {
			t.Fatalf("forbidden CLI flag passed: %q", arg)
		}
	}
}

func TestLifecycleProxy_StartShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Start(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "start"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_StopShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Stop(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "stop"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_RestartShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Restart(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "restart"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_UninstallShellsOutCorrectly(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Uninstall(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantArgs := []string{"/abs/repo/dist/entry.js", "gateway", "uninstall"}
	if !equalSlices(exec.calls[0].Args, wantArgs) {
		t.Fatalf("got args %v, want %v", exec.calls[0].Args, wantArgs)
	}
}

func TestLifecycleProxy_ReinstallIsUninstallThenInstall(t *testing.T) {
	exec := &fakeExec{}
	if _, err := newProxy(exec).Reinstall(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(exec.calls) != 2 {
		t.Fatalf("expected 2 exec calls (uninstall+install), got %d", len(exec.calls))
	}
	if exec.calls[0].Args[2] != "uninstall" {
		t.Fatalf("expected first call uninstall, got %q", exec.calls[0].Args[2])
	}
	if exec.calls[1].Args[2] != "install" {
		t.Fatalf("expected second call install, got %q", exec.calls[1].Args[2])
	}
}

func TestLifecycleProxy_ExecFailureSurfacesStderr(t *testing.T) {
	exec := &fakeExec{err: errors.New("exit status 1: launchctl rejected")}
	_, err := newProxy(exec).Start(context.Background())
	if err == nil || !strings.Contains(err.Error(), "launchctl rejected") {
		t.Fatalf("expected wrapped exec error, got %v", err)
	}
}

func TestLifecycleProxy_ServiceNameEnvVarsAreNotInheritedOverridable(t *testing.T) {
	exec := &fakeExec{}
	p := &LifecycleProxy{
		ServiceName:    "openclaw-gateway.correctname1",
		EntrypointPath: "/abs/repo/dist/entry.js",
		Exec:           exec,
		InheritEnv: []string{
			"OPENCLAW_LAUNCHD_LABEL=hijacked-name",
			"PATH=/usr/bin",
		},
	}
	if _, err := p.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	mustHaveEnv(t, exec.calls[0], "OPENCLAW_LAUNCHD_LABEL", "openclaw-gateway.correctname1")
	mustHaveEnv(t, exec.calls[0], "PATH", "/usr/bin")
}

func equalSlices(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func mustHaveEnv(t *testing.T, call ExecCall, key string, value string) {
	t.Helper()
	want := key + "=" + value
	for _, env := range call.Env {
		if env == want {
			return
		}
	}
	t.Fatalf("missing env entry %q in %v", want, call.Env)
}
