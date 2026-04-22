package transport

import (
	"context"
	"net/url"
	"strings"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

func ProbeConnection(ctx context.Context, rawURL string, token string) error {
	trimmedURL := strings.TrimSpace(rawURL)
	if trimmedURL == "" {
		return errString("url is required")
	}
	if strings.TrimSpace(token) == "" {
		return errString("token is required")
	}
	parsed, err := url.Parse(trimmedURL)
	if err != nil {
		return errString("Invalid URL format")
	}
	if parsed.Scheme != "ws" && parsed.Scheme != "wss" {
		return errString("Only ws:// and wss:// protocols are allowed")
	}
	return gateway.ProbeHealth(ctx, trimmedURL, strings.TrimSpace(token))
}

func ProbeManagedHealth(ctx context.Context, cfg config.ManagedGatewaySettings) error {
	return gateway.ProbeHealth(ctx, config.ManagedGatewayURL(cfg), cfg.GatewayToken)
}

type errString string

func (e errString) Error() string { return string(e) }
