package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/bundled"
)

type RuntimeGatewayActionResponse = deckapi.DeckGoRuntimeGatewayActionResponse

func (m *ManagedRuntime) RuntimeGatewayStatusResponse() RuntimeGatewayActionResponse {
	return RuntimeGatewayActionResponse{
		Ok:      true,
		Runtime: runtimeStatus(m.Snapshot()),
	}
}

func (m *ManagedRuntime) StartRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	snapshot, err := m.Start(ctx)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatus(snapshot),
	}, err
}

func (m *ManagedRuntime) StopRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	snapshot, err := m.Stop(ctx)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatus(snapshot),
	}, err
}

func (m *ManagedRuntime) RestartRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	snapshot, err := m.Restart(ctx)
	return RuntimeGatewayActionResponse{
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
	if runtimeSnapshot.Status == bundled.StatusRunning || runtimeSnapshot.Status == bundled.StatusDegraded {
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

func runtimeStatus(snapshot bundled.Snapshot) deckapi.DeckGoRuntimeGatewayStatus {
	return deckapi.DeckGoRuntimeGatewayStatus{
		Managed:         snapshot.Managed,
		Configured:      snapshot.Configured,
		Status:          string(snapshot.Status),
		FailurePhase:    string(snapshot.FailurePhase),
		Pid:             float64(snapshot.PID),
		StartedAt:       snapshot.StartedAt,
		LastExitAt:      snapshot.LastExitAt,
		LastExitCode:    float64(snapshot.LastExitCode),
		Health:          string(snapshot.Health),
		GatewayUrl:      snapshot.GatewayURL,
		LastError:       snapshot.LastError,
		AutoStart:       snapshot.AutoStart,
		Owner:           snapshot.Owner,
		OwnershipState:  snapshot.OwnershipState,
		OwnershipFile:   snapshot.OwnershipFile,
		RestartAttempts: float64(snapshot.RestartAttempts),
		RestartDelayMs:  float64(snapshot.RestartDelayMs),
	}
}
