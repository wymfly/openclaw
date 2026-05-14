package bundled

import (
	"context"
	"errors"
	"testing"
)

type fakeServiceQuerier struct {
	registered bool
	active     bool
	queryErr   error
}

func (f *fakeServiceQuerier) Query(context.Context, string) (ServiceState, error) {
	if f.queryErr != nil {
		return ServiceState{}, f.queryErr
	}
	return ServiceState{Registered: f.registered, Active: f.active}, nil
}

type fakeHealthClient struct {
	healthy   bool
	healthErr error
}

func (f *fakeHealthClient) Health(context.Context) error {
	if f.healthErr != nil {
		return f.healthErr
	}
	if !f.healthy {
		return ErrHealthProbeNotOK
	}
	return nil
}

func TestProbe_RunningWhenActiveAndHealthy(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: true},
		Health:  &fakeHealthClient{healthy: true},
	}
	res, err := p.Probe(context.Background(), ProbeInputs{
		ServiceName:      "svc",
		EntrypointPath:   "/tmp/entry.js",
		EntrypointExists: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.LifecycleState != StateRunning {
		t.Fatalf("expected %q, got %q (lastError=%q)", StateRunning, res.LifecycleState, res.LastError)
	}
}

func TestProbe_StoppedWhenRegisteredButInactive(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: false},
		Health:  &fakeHealthClient{},
	}
	res, err := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.LifecycleState != StateStopped {
		t.Fatalf("expected stopped, got %q", res.LifecycleState)
	}
}

func TestProbe_NotInstalledWhenUnregistered(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: false},
		Health:  &fakeHealthClient{},
	}
	res, err := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.LifecycleState != StateNotInstalled {
		t.Fatalf("expected not-installed, got %q", res.LifecycleState)
	}
	if res.LastError != ErrCodeServiceNotRegistered {
		t.Fatalf("expected lastError=%q, got %q", ErrCodeServiceNotRegistered, res.LastError)
	}
}

func TestProbe_NotInstalledWhenEntrypointMissing(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: false},
		Health:  &fakeHealthClient{},
	}
	res, err := p.Probe(context.Background(), ProbeInputs{EntrypointExists: false})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.LifecycleState != StateNotInstalled {
		t.Fatalf("expected not-installed (entrypoint missing), got %q", res.LifecycleState)
	}
	if res.LastError != ErrCodeEntrypointNotFound {
		t.Fatalf("expected lastError=%q, got %q", ErrCodeEntrypointNotFound, res.LastError)
	}
}

func TestProbe_UnhealthyWhenActiveButHealthFails(t *testing.T) {
	cases := []struct {
		name      string
		probeErr  error
		wantError string
	}{
		{"timeout", ErrHealthProbeTimeout, ErrCodeProbeTimeout},
		{"refused", ErrHealthProbeRefused, ErrCodeProbeRefused},
		{"non_ok", ErrHealthProbeNotOK, ErrCodeProbeNonOK},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := &LifecycleProbe{
				Service: &fakeServiceQuerier{registered: true, active: true},
				Health:  &fakeHealthClient{healthErr: c.probeErr},
			}
			res, err := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.LifecycleState != StateUnhealthy {
				t.Fatalf("expected unhealthy, got %q", res.LifecycleState)
			}
			if res.LastError != c.wantError {
				t.Fatalf("expected lastError=%q, got %q", c.wantError, res.LastError)
			}
		})
	}
}

func TestProbe_UnhealthyOnEntrypointPathDrift(t *testing.T) {
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{registered: true, active: true},
		Health:  &fakeHealthClient{healthy: true},
	}
	res, err := p.Probe(context.Background(), ProbeInputs{
		EntrypointExists:        true,
		EntrypointDriftDetected: true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.LifecycleState != StateUnhealthy {
		t.Fatalf("expected unhealthy on drift, got %q", res.LifecycleState)
	}
	if res.LastError != ErrCodeEntrypointPathDrift {
		t.Fatalf("expected drift code, got %q", res.LastError)
	}
}

func TestProbe_PropagatesServiceQueryError(t *testing.T) {
	boom := errors.New("boom")
	p := &LifecycleProbe{
		Service: &fakeServiceQuerier{queryErr: boom},
		Health:  &fakeHealthClient{},
	}
	_, err := p.Probe(context.Background(), ProbeInputs{EntrypointExists: true})
	if !errors.Is(err, boom) {
		t.Fatalf("expected wrapped query error, got %v", err)
	}
}
