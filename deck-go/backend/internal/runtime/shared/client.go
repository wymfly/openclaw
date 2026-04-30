package shared

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/gateway"
)

const defaultRequestTimeout = 8 * time.Second

type Endpoint struct {
	URL       string
	Token     string
	TLSVerify bool
}

type Client struct {
	endpoint Endpoint
	timeout  time.Duration
}

func NewClient(endpoint Endpoint) *Client {
	return &Client{endpoint: endpoint, timeout: defaultRequestTimeout}
}

func (c *Client) Endpoint() Endpoint {
	return c.endpoint
}

func (c *Client) Timeout() time.Duration {
	return c.timeout
}

func (c *Client) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if !c.endpoint.TLSVerify && strings.TrimSpace(c.endpoint.URL) != "" {
		log.Printf("WARN remote gateway RPC issued with tlsVerify=false url=%s method=%s", c.endpoint.URL, method)
	}
	if c.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
		defer cancel()
	}
	return gateway.RequestDirectWithOptions(ctx, c.endpoint.URL, c.endpoint.Token, method, params, gateway.DirectRequestOptions{
		HandshakeTimeout:      c.timeout,
		InsecureSkipTLSVerify: !c.endpoint.TLSVerify,
	})
}
