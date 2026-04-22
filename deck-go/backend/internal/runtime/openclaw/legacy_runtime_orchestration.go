package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	runtimecontrol "github.com/openclaw/openclaw/deck-go/backend/internal/runtime"
)

func (m *ManagedRuntime) RuntimeGatewayStatusResponse() deckapi.DeckGoRuntimeGatewayActionResponse {
	return deckapi.DeckGoRuntimeGatewayActionResponse{
		Ok:      true,
		Runtime: runtimeStatus(m.Snapshot()),
	}
}

func (m *ManagedRuntime) StartRuntimeGateway(ctx context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error) {
	snapshot, err := m.Start(ctx)
	return deckapi.DeckGoRuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatus(snapshot),
	}, err
}

func (m *ManagedRuntime) StopRuntimeGateway(ctx context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error) {
	snapshot, err := m.Stop(ctx)
	return deckapi.DeckGoRuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatus(snapshot),
	}, err
}

func (m *ManagedRuntime) RestartRuntimeGateway(ctx context.Context) (deckapi.DeckGoRuntimeGatewayActionResponse, error) {
	snapshot, err := m.Restart(ctx)
	return deckapi.DeckGoRuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatus(snapshot),
	}, err
}

func (m *ManagedRuntime) BootstrapStatus(ctx context.Context) (deckapi.DeckGoBootstrapStatusResponse, error) {
	payload := deckapi.DeckGoBootstrapStatusResponse{
		Ok: true,
		Gateway: deckapi.DeckGoBootstrapGatewayStatus{
			Connected: false,
		},
	}
	if m == nil || m.store == nil {
		return payload, nil
	}
	effective := m.store.Effective()
	runtimeSnapshot := m.Snapshot()
	payload.Settings = deckapi.DeckGoBootstrapSettingsStatus{
		Path:                     m.store.Path(),
		AccessTokenConfigured:    effective.AccessToken != "",
		ManagedGatewayConfigured: runtimeSnapshot.Configured,
		CommandConfigured:        effective.ManagedGateway.Command != "",
		GatewayTokenConfigured:   effective.ManagedGateway.GatewayToken != "",
		AutoStart:                effective.ManagedGateway.AutoStart,
	}
	payload.Runtime = runtimeStatus(runtimeSnapshot)
	if runtimeSnapshot.Status == runtimecontrol.StatusRunning || runtimeSnapshot.Status == runtimecontrol.StatusDegraded {
		summary, _ := m.LoadGatewayStatus(ctx)
		payload.Gateway = deckapi.DeckGoBootstrapGatewayStatus{
			Connected:                   summary.Connected,
			Error:                       summary.Error,
			CapabilitySnapshotAvailable: summary.CapabilitySnapshotAvailable,
			MethodCount:                 float64(summary.MethodCount),
			EventCount:                  float64(summary.EventCount),
			SchemaVersion:               summary.SchemaVersion,
		}
	}
	return payload, nil
}

func runtimeStatus(snapshot runtimecontrol.Snapshot) deckapi.DeckGoRuntimeGatewayStatus {
	return deckapi.DeckGoRuntimeGatewayStatus{
		Managed:      snapshot.Managed,
		Configured:   snapshot.Configured,
		Status:       string(snapshot.Status),
		FailurePhase: snapshot.FailurePhase,
		Pid:          float64(snapshot.PID),
		StartedAt:    snapshot.StartedAt,
		LastExitAt:   snapshot.LastExitAt,
		LastExitCode: float64(snapshot.LastExitCode),
		Health:       string(snapshot.Health),
		GatewayUrl:   snapshot.GatewayURL,
		LastError:    snapshot.LastError,
		AutoStart:    snapshot.AutoStart,
	}
}
