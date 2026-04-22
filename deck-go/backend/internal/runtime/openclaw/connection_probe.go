package openclaw

import (
	"context"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	runtimetransport "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/transport"
)

func ProbeConnection(ctx context.Context, rawURL string, token string) error {
	return runtimetransport.ProbeConnection(ctx, rawURL, token)
}

func ProbeManagedHealth(ctx context.Context, cfg config.ManagedGatewaySettings) error {
	return runtimetransport.ProbeManagedHealth(ctx, cfg)
}
