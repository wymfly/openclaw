package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

type RuntimeGatewayActionResponse = deckapi.DeckGoRuntimeGatewayActionResponse

func (m *ManagedRuntime) RuntimeGatewayStatusResponse() RuntimeGatewayActionResponse {
	status, _ := m.refreshFacadeStatus(context.Background())
	return RuntimeGatewayActionResponse{
		Ok:      true,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}
}

func (m *ManagedRuntime) StartRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	if m == nil || m.facade == nil {
		return RuntimeGatewayActionResponse{}, facade.ErrUnsupported
	}
	status, err := m.facade.Start(ctx)
	m.setLastStatus(status)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}, err
}

func (m *ManagedRuntime) StopRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	if m == nil || m.facade == nil {
		return RuntimeGatewayActionResponse{}, facade.ErrUnsupported
	}
	status, err := m.facade.Stop(ctx)
	m.setLastStatus(status)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}, err
}

func (m *ManagedRuntime) RestartRuntimeGateway(ctx context.Context) (RuntimeGatewayActionResponse, error) {
	if m == nil || m.facade == nil {
		return RuntimeGatewayActionResponse{}, facade.ErrUnsupported
	}
	status, err := m.facade.Restart(ctx)
	m.setLastStatus(status)
	return RuntimeGatewayActionResponse{
		Ok:      err == nil,
		Runtime: runtimeStatusFromFacadeStatus(status),
	}, err
}

func (m *ManagedRuntime) refreshFacadeStatus(ctx context.Context) (facade.RuntimeStatus, error) {
	if m == nil || m.facade == nil {
		return facade.RuntimeStatus{}, nil
	}
	status, err := m.facade.RuntimeGatewayStatus(ctx)
	if err == nil {
		m.setLastStatus(status)
	}
	return status, err
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
	status, _ := m.refreshFacadeStatus(ctx)
	payload.Settings = deckapi.DeckGoBootstrapSettingsStatus{
		Path:                     m.store.Path(),
		AccessTokenConfigured:    effective.AccessToken != "",
		ManagedGatewayConfigured: status.Configured,
		CommandConfigured:        effective.ManagedGateway.Command != "",
		GatewayTokenConfigured:   effective.ManagedGateway.GatewayToken != "",
		AutoStart:                effective.ManagedGateway.AutoStart,
	}
	payload.Runtime = runtimeStatusFromFacadeStatus(status)
	if status.Status == "running" || status.Status == "degraded" {
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

func runtimeStatusFromFacadeStatus(status facade.RuntimeStatus) deckapi.DeckGoRuntimeGatewayStatus {
	resp := deckapi.DeckGoRuntimeGatewayStatus{
		Mode:            status.Mode,
		Managed:         status.Mode == "bundled",
		Configured:      status.Configured,
		Status:          status.Status,
		Health:          status.Health,
		GatewayUrl:      status.GatewayURL,
		AutoStart:       status.AutoStart,
		OwnershipState:  status.OwnershipState,
		RestartAttempts: float64(status.RestartAttempts),
	}
	if status.PID != nil {
		resp.Pid = float64(*status.PID)
	}
	if status.LastConnectedAt != nil {
		resp.LastConnectedAt = *status.LastConnectedAt
	}
	if status.LastError != nil {
		resp.LastError = *status.LastError
	}
	if status.LatencyP50 != nil {
		resp.LatencyP50 = float64(*status.LatencyP50)
	}
	if status.TLSVerified != nil {
		resp.TlsVerified = *status.TLSVerified
	}
	return resp
}
