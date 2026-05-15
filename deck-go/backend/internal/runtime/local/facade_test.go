package local

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type stubExecRunner struct {
	calls []ExecCall
	err   error
}

func (s *stubExecRunner) Run(_ context.Context, call ExecCall) ([]byte, error) {
	s.calls = append(s.calls, call)
	return nil, s.err
}

type stubServiceQuerier struct {
	state ServiceState
	err   error
}

func (s *stubServiceQuerier) Query(context.Context, string) (ServiceState, error) {
	if s.err != nil {
		return ServiceState{}, s.err
	}
	return s.state, nil
}

type stubHealthProbe struct {
	err error
}

func (s *stubHealthProbe) Health(context.Context) error {
	return s.err
}

func newLocalTestFacade(t *testing.T, svc *stubServiceQuerier, health *stubHealthProbe, exec ExecRunner) *Facade {
	t.Helper()
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")
	rt, err := NewWithDependencies(&envconf.RuntimeLocalConfig{}, Dependencies{
		ResolveOpts: ResolveOptions{RepoRootEnv: repo},
		ServiceName: "openclaw-gateway.testhash1234",
		Probe: &LifecycleProbe{
			Service: svc,
			Health:  health,
		},
		ProxyExec: exec,
		InheritEnv: []string{
			"PATH=/usr/bin",
		},
	})
	if err != nil {
		t.Fatalf("NewWithDependencies() error = %v", err)
	}
	return rt
}

func TestLocalFacadeCapabilitiesReportsRunningConfigured(t *testing.T) {
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: true}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "local" || !caps.Configured || caps.EndpointMutable || !caps.SupervisorState {
		t.Fatalf("capabilities = %#v", caps)
	}
}

func TestLocalFacadeCapabilitiesReportsNotConfiguredWhenNotInstalled(t *testing.T) {
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: false}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "local" || caps.Configured || caps.EndpointMutable || !caps.SupervisorState {
		t.Fatalf("capabilities = %#v", caps)
	}
}

func TestLocalFacadeRuntimeGatewayStatusPopulatesLifecycleFields(t *testing.T) {
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: true}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	status, err := rt.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatalf("RuntimeGatewayStatus() error = %v", err)
	}
	if status.Mode != "local" || status.LifecycleState != string(StateRunning) {
		t.Fatalf("unexpected status = %#v", status)
	}
	if status.ServiceName != "openclaw-gateway.testhash1234" {
		t.Fatalf("ServiceName = %q", status.ServiceName)
	}
	if status.EntrypointPath == "" {
		t.Fatalf("EntrypointPath empty in %#v", status)
	}
	if status.PID != nil || status.OwnershipState != "" || status.RestartAttempts != 0 {
		t.Fatalf("legacy supervisor fields leaked into lifecycle status: %#v", status)
	}
}

func TestLocalFacadeRuntimeGatewayStatusReportsAutoStartFalse(t *testing.T) {
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	status, err := rt.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatalf("RuntimeGatewayStatus() error = %v", err)
	}
	if status.AutoStart {
		t.Fatalf("AutoStart = true, want false")
	}
}

func TestLocalFacadeRuntimeGatewayStatusLastErrorOnUnhealthy(t *testing.T) {
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: true}},
		&stubHealthProbe{err: ErrHealthProbeRefused},
		&stubExecRunner{},
	)
	status, err := rt.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatalf("RuntimeGatewayStatus() error = %v", err)
	}
	if status.LifecycleState != string(StateUnhealthy) {
		t.Fatalf("LifecycleState = %q", status.LifecycleState)
	}
	if status.LastError == nil || *status.LastError != ErrCodeProbeRefused {
		t.Fatalf("LastError = %v", status.LastError)
	}
}

func TestLocalFacadeLifecycleActionsInvokeProxyAndReturnProbe(t *testing.T) {
	exec := &stubExecRunner{}
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
		&stubHealthProbe{err: ErrHealthProbeRefused},
		exec,
	)
	actions := []struct {
		name string
		run  func(context.Context) (facade.RuntimeStatus, error)
	}{
		{"install", rt.Install},
		{"start", rt.Start},
		{"stop", rt.Stop},
		{"restart", rt.Restart},
		{"reinstall", rt.Reinstall},
	}
	for _, action := range actions {
		t.Run(action.name, func(t *testing.T) {
			before := len(exec.calls)
			status, err := action.run(context.Background())
			if err != nil {
				t.Fatalf("%s() error = %v", action.name, err)
			}
			if status.LifecycleState != string(StateStopped) {
				t.Fatalf("%s() status = %#v", action.name, status)
			}
			if len(exec.calls) <= before {
				t.Fatalf("%s() did not invoke proxy", action.name)
			}
		})
	}
}

func TestLocalFacadeLifecycleActionSurfacesProxyFailureWithStatus(t *testing.T) {
	exec := &stubExecRunner{err: errors.New("launchctl rejected")}
	rt := newLocalTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
		&stubHealthProbe{err: ErrHealthProbeRefused},
		exec,
	)
	status, err := rt.Start(context.Background())
	if err == nil || !errors.Is(err, exec.err) {
		t.Fatalf("Start() error = %v, want proxy error", err)
	}
	if status.LifecycleState != string(StateStopped) {
		t.Fatalf("expected post-failure probe status, got %#v", status)
	}
}

func TestLocalEndpointUpdateUnsupported(t *testing.T) {
	rt := newLocalTestFacade(t, &stubServiceQuerier{}, &stubHealthProbe{}, &stubExecRunner{})
	_, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://gateway.example.test",
		Token:     "token",
		TLSVerify: true,
	})
	if !errors.Is(err, facade.ErrUnsupported) {
		t.Fatalf("UpdateRemoteEndpoint() error = %v, want ErrUnsupported", err)
	}
}

func TestLocalFacadeNewDoesNotFailWhenEntrypointMissing(t *testing.T) {
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("OPENCLAW_REPO_ROOT", filepath.Join(cwd, "missing-repo"))
	rt, err := New(&envconf.RuntimeLocalConfig{})
	if err != nil {
		t.Fatalf("New() should not fail on missing entrypoint, got %v", err)
	}
	status, err := rt.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatalf("RuntimeGatewayStatus() error = %v", err)
	}
	if status.LifecycleState != string(StateNotInstalled) {
		t.Fatalf("expected missing entrypoint as not-installed, got %#v", status)
	}
}

func TestLocalFacadeGatewayConnectionReadsStateFile(t *testing.T) {
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")
	stateDir := writeGatewayStateFile(t, `{"gateway":{"port":19001,"auth":{"mode":"token","token":"state-token"}}}`)

	rt, err := NewWithDependencies(&envconf.RuntimeLocalConfig{StateDir: stateDir}, Dependencies{
		ResolveOpts: ResolveOptions{RepoRootEnv: repo},
		ServiceName: "openclaw-gateway.state",
		Probe: &LifecycleProbe{
			Service: &stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
			Health:  &stubHealthProbe{},
		},
		ProxyExec:  &stubExecRunner{},
		InheritEnv: []string{"PATH=/usr/bin"},
	})
	if err != nil {
		t.Fatalf("NewWithDependencies() error = %v", err)
	}

	conn, err := rt.GatewayConnection(context.Background())
	if err != nil {
		t.Fatalf("GatewayConnection() error = %v", err)
	}
	if conn.URL != "ws://127.0.0.1:19001" || conn.Token != "state-token" {
		t.Fatalf("GatewayConnection() = %#v", conn)
	}
	endpoint, err := rt.Endpoint(context.Background())
	if err != nil {
		t.Fatalf("Endpoint() error = %v", err)
	}
	if endpoint.Source != "openclaw-state" {
		t.Fatalf("Endpoint().Source = %q, want openclaw-state", endpoint.Source)
	}
}

func TestLocalFacadeNewUsesProcessEnvForStateSecrets(t *testing.T) {
	resetLegacyEnvWarnState()
	defer resetLegacyEnvWarnState()
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")
	stateDir := writeGatewayStateFile(t, `{"gateway":{"port":19007,"auth":{"mode":"token","token":"${OPENCLAW_GATEWAY_TOKEN}"}}}`)
	t.Setenv("OPENCLAW_REPO_ROOT", repo)
	t.Setenv("OPENCLAW_GATEWAY_TOKEN", "process-token")

	rt, err := New(&envconf.RuntimeLocalConfig{StateDir: stateDir})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}

	conn, err := rt.GatewayConnection(context.Background())
	if err != nil {
		t.Fatalf("GatewayConnection() error = %v", err)
	}
	if conn.URL != "ws://127.0.0.1:19007" || conn.Token != "process-token" {
		t.Fatalf("GatewayConnection() = %#v", conn)
	}
}

func TestLocalFacadeDefaultHealthClientIsResolverDriven(t *testing.T) {
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")
	stateDir := writeGatewayStateFile(t, `{"gateway":{"port":19001,"auth":{"mode":"token","token":"state-token-1"}}}`)

	rt, err := NewWithDependencies(&envconf.RuntimeLocalConfig{StateDir: stateDir}, Dependencies{
		ResolveOpts: ResolveOptions{RepoRootEnv: repo},
		ServiceName: "openclaw-gateway.resolver",
		ProxyExec:   &stubExecRunner{},
		InheritEnv:  []string{"PATH=/usr/bin"},
	})
	if err != nil {
		t.Fatalf("NewWithDependencies() error = %v", err)
	}
	health, ok := rt.probe.Health.(*GatewayHealthClient)
	if !ok {
		t.Fatalf("default health client = %T, want *GatewayHealthClient", rt.probe.Health)
	}

	url, token := health.Resolve()
	if url != "ws://127.0.0.1:19001" || token != "state-token-1" {
		t.Fatalf("Resolve() = %q, %q", url, token)
	}

	writeGatewayStateFileAt(t, stateDir, `{"gateway":{"port":19002,"auth":{"mode":"token","token":"state-token-2"}}}`)
	url, token = health.Resolve()
	if url != "ws://127.0.0.1:19002" || token != "state-token-2" {
		t.Fatalf("Resolve() after state change = %q, %q", url, token)
	}
}

func TestLocalFacadeWarnsLegacyEnvKeysAtConstruction(t *testing.T) {
	resetLegacyEnvWarnState()
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")
	buf := &bytes.Buffer{}

	_, err := NewWithDependencies(&envconf.RuntimeLocalConfig{
		LegacyBundledKeys: []string{"RUNTIME_BUNDLED_BIND_PORT"},
	}, Dependencies{
		ResolveOpts: ResolveOptions{RepoRootEnv: repo},
		ServiceName: "openclaw-gateway.legacy",
		Probe: &LifecycleProbe{
			Service: &stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
			Health:  &stubHealthProbe{},
		},
		ProxyExec:         &stubExecRunner{},
		InheritEnv:        []string{"PATH=/usr/bin", "RUNTIME_BUNDLED_TOKEN=ignored"},
		LegacyEnvWarnSink: buf,
	})
	if err != nil {
		t.Fatalf("NewWithDependencies() error = %v", err)
	}
	out := buf.String()
	for _, key := range []string{"RUNTIME_BUNDLED_BIND_PORT", "RUNTIME_BUNDLED_TOKEN"} {
		if !strings.Contains(out, key) {
			t.Fatalf("warning missing %s: %q", key, out)
		}
	}
}

func writeGatewayStateFile(t *testing.T, contents string) string {
	t.Helper()
	dir := t.TempDir()
	writeGatewayStateFileAt(t, dir, contents)
	return dir
}

func writeGatewayStateFileAt(t *testing.T, dir string, contents string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "openclaw.json"), []byte(contents), 0o600); err != nil {
		t.Fatal(err)
	}
}
