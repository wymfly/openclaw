package bundled

import (
	"context"
	"errors"
	"os"
	"path/filepath"
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

func newBundledTestFacade(t *testing.T, svc *stubServiceQuerier, health *stubHealthProbe, exec ExecRunner) *Facade {
	t.Helper()
	repo := t.TempDir()
	writeTestFile(t, filepath.Join(repo, "package.json"), `{"name":"openclaw"}`)
	writeTestFile(t, filepath.Join(repo, "dist", "entry.js"), "// stub")
	rt, err := NewWithDependencies(&envconf.RuntimeBundledConfig{
		BindHost: "127.0.0.1",
		BindPort: 18789,
		Token:    "token-1",
	}, Dependencies{
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

func TestBundledFacadeCapabilitiesReportsRunningConfigured(t *testing.T) {
	rt := newBundledTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: true}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "bundled" || !caps.Configured || caps.EndpointMutable || !caps.SupervisorState {
		t.Fatalf("capabilities = %#v", caps)
	}
}

func TestBundledFacadeCapabilitiesReportsNotConfiguredWhenNotInstalled(t *testing.T) {
	rt := newBundledTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: false}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	caps, err := rt.Capabilities(context.Background())
	if err != nil {
		t.Fatalf("Capabilities() error = %v", err)
	}
	if caps.Mode != "bundled" || caps.Configured || caps.EndpointMutable || !caps.SupervisorState {
		t.Fatalf("capabilities = %#v", caps)
	}
}

func TestBundledFacadeRuntimeGatewayStatusPopulatesLifecycleFields(t *testing.T) {
	rt := newBundledTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: true}},
		&stubHealthProbe{},
		&stubExecRunner{},
	)
	status, err := rt.RuntimeGatewayStatus(context.Background())
	if err != nil {
		t.Fatalf("RuntimeGatewayStatus() error = %v", err)
	}
	if status.Mode != "bundled" || status.LifecycleState != string(StateRunning) {
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

func TestBundledFacadeRuntimeGatewayStatusLastErrorOnUnhealthy(t *testing.T) {
	rt := newBundledTestFacade(t,
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

func TestBundledFacadeLifecycleActionsInvokeProxyAndReturnProbe(t *testing.T) {
	exec := &stubExecRunner{}
	rt := newBundledTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
		&stubHealthProbe{},
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

func TestBundledFacadeLifecycleActionSurfacesProxyFailureWithStatus(t *testing.T) {
	exec := &stubExecRunner{err: errors.New("launchctl rejected")}
	rt := newBundledTestFacade(t,
		&stubServiceQuerier{state: ServiceState{Registered: true, Active: false}},
		&stubHealthProbe{},
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

func TestBundledEndpointUpdateUnsupported(t *testing.T) {
	rt := newBundledTestFacade(t, &stubServiceQuerier{}, &stubHealthProbe{}, &stubExecRunner{})
	_, err := rt.UpdateRemoteEndpoint(context.Background(), facade.RemoteEndpointInput{
		URL:       "https://gateway.example.test",
		Token:     "token",
		TLSVerify: true,
	})
	if !errors.Is(err, facade.ErrUnsupported) {
		t.Fatalf("UpdateRemoteEndpoint() error = %v, want ErrUnsupported", err)
	}
}

func TestBundledFacadeNewDoesNotFailWhenEntrypointMissing(t *testing.T) {
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("OPENCLAW_REPO_ROOT", filepath.Join(cwd, "missing-repo"))
	rt, err := New(&envconf.RuntimeBundledConfig{})
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
