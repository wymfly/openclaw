package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

type ManagedConnectionProvider interface {
	GatewayConnection() (string, string, bool)
}

type transportBindingLike interface {
	NewRequester(provider ManagedConnectionProvider) Requester
	NewSubscriptionController(provider ManagedConnectionProvider, bus *events.Bus) SessionSubscriptionController
	ProbeHealth(ctx context.Context, upstreamURL string, token string) error
	InvalidateProbeClient(upstreamURL string, token string)
	CurrentDeviceID() (string, error)
}

var transportBinding transportBindingLike = gatewayTransportBinding{}

type gatewayTransportBinding struct{}

func (gatewayTransportBinding) NewRequester(provider ManagedConnectionProvider) Requester {
	return gateway.New(provider)
}

func (gatewayTransportBinding) NewSubscriptionController(provider ManagedConnectionProvider, bus *events.Bus) SessionSubscriptionController {
	return gateway.NewRealtime(provider, bus)
}

func (gatewayTransportBinding) ProbeHealth(ctx context.Context, upstreamURL string, token string) error {
	return gateway.ProbeHealth(ctx, upstreamURL, token)
}

func (gatewayTransportBinding) InvalidateProbeClient(upstreamURL string, token string) {
	gateway.InvalidateProbeClient(upstreamURL, token)
}

func (gatewayTransportBinding) CurrentDeviceID() (string, error) {
	return gateway.CurrentDeviceID()
}
