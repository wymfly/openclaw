package admin

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type fakeRuntimeFacade struct {
	caps         facade.Capabilities
	status       facade.RuntimeStatus
	statusErr    error
	statusCalls  int
	reloadStatus facade.RuntimeStatus
	reloadErr    error
	reloadCalls  int
}

func (f *fakeRuntimeFacade) Capabilities(context.Context) (facade.Capabilities, error) {
	return f.caps, nil
}

func (f *fakeRuntimeFacade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	f.statusCalls++
	if f.statusErr != nil {
		return facade.RuntimeStatus{}, f.statusErr
	}
	return f.status, nil
}

func (f *fakeRuntimeFacade) ReloadRuntime(context.Context) (facade.RuntimeStatus, error) {
	f.reloadCalls++
	if f.reloadErr != nil {
		return facade.RuntimeStatus{}, f.reloadErr
	}
	return f.reloadStatus, nil
}

func TestDispatchStatusReturnsReadOnlyDocument(t *testing.T) {
	lastError := "last failure"
	lastConnectedAt := "2026-04-28T00:00:00Z"
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      true,
			EndpointMutable: true,
			SupervisorState: false,
		},
		status: facade.RuntimeStatus{
			LastError:       &lastError,
			LastConnectedAt: &lastConnectedAt,
		},
	}

	raw, err := Dispatch(context.Background(), rt, VerbStatus)
	if err != nil {
		t.Fatalf("Dispatch(status) error = %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["mode"] != "remote" || payload["configured"] != true || payload["endpointMutable"] != true || payload["supervisorState"] != false {
		t.Fatalf("unexpected status payload: %#v", payload)
	}
	if payload["lastError"] != lastError || payload["lastConnectedAt"] != lastConnectedAt {
		t.Fatalf("missing tail-state fields: %#v", payload)
	}
	if rt.reloadCalls != 0 {
		t.Fatalf("status dispatch called ReloadRuntime %d times", rt.reloadCalls)
	}
}

func TestDispatchStatusToleratesFirstRunNotConfigured(t *testing.T) {
	rt := &fakeRuntimeFacade{
		caps: facade.Capabilities{
			Mode:            "remote",
			Configured:      false,
			EndpointMutable: true,
			SupervisorState: false,
		},
		statusErr: facade.ErrNotConfigured,
	}

	raw, err := Dispatch(context.Background(), rt, VerbStatus)
	if err != nil {
		t.Fatalf("Dispatch(status) error = %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["configured"] != false {
		t.Fatalf("unexpected first-run status payload: %#v", payload)
	}
	if _, exists := payload["lastError"]; exists {
		t.Fatalf("first-run status should omit tail state when runtime status is unavailable: %#v", payload)
	}
}

func TestDispatchUnknownVerb(t *testing.T) {
	_, err := Dispatch(context.Background(), &fakeRuntimeFacade{}, Verb("start"))
	if !errors.Is(err, ErrUnknownVerb) {
		t.Fatalf("Dispatch(unknown) error = %v, want ErrUnknownVerb", err)
	}
}

func TestDispatchReloadRuntimeCallsFacadeReload(t *testing.T) {
	lastError := ""
	rt := &fakeRuntimeFacade{
		reloadStatus: facade.RuntimeStatus{Mode: "remote", LastError: &lastError},
	}
	_, err := Dispatch(context.Background(), rt, VerbReloadRuntime)
	if err != nil {
		t.Fatalf("Dispatch(reload-runtime) error = %v", err)
	}
	if rt.reloadCalls != 1 {
		t.Fatalf("reload-runtime called facade %d times, want 1", rt.reloadCalls)
	}
}
