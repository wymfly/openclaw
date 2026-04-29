package remote

import (
	"context"
	"errors"
	"net/http"
	"sync"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/shared"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

type gatewayClient interface {
	Request(ctx context.Context, method string, params map[string]any) (any, error)
	Close() error
}

type sharedGatewayClient struct {
	client  *shared.Client
	mu      sync.Mutex
	cond    *sync.Cond
	nextID  int
	active  int
	closed  bool
	cancels map[int]context.CancelFunc
}

func newRuntimeGatewayClient(endpoint runtimestate.RemoteEndpoint) gatewayClient {
	return &sharedGatewayClient{client: newGatewayClient(endpoint)}
}

func (c *sharedGatewayClient) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if c == nil || c.client == nil {
		return nil, errors.New("remote gateway client is not configured")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithCancel(ctx)
	id, ok := c.beginRequest(cancel)
	if !ok {
		cancel()
		return nil, endpointSwitchingError()
	}
	defer c.endRequest(id)
	payload, err := c.client.Request(ctx, method, params)
	if err != nil && c.isClosed() && errors.Is(ctx.Err(), context.Canceled) {
		return nil, endpointSwitchingError()
	}
	return payload, err
}

func (c *sharedGatewayClient) Close() error {
	if c == nil {
		return nil
	}
	c.mu.Lock()
	c.ensureCondLocked()
	if c.closed {
		c.mu.Unlock()
		return nil
	}
	c.closed = true
	cancels := make([]context.CancelFunc, 0, len(c.cancels))
	for _, cancel := range c.cancels {
		cancels = append(cancels, cancel)
	}
	c.cond.Broadcast()
	c.mu.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
	return nil
}

func (c *sharedGatewayClient) Drain(ctx context.Context) error {
	if c == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	done := make(chan struct{})
	go func() {
		c.mu.Lock()
		c.ensureCondLocked()
		for c.active > 0 && !c.closed {
			c.cond.Wait()
		}
		c.mu.Unlock()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *sharedGatewayClient) beginRequest(cancel context.CancelFunc) (int, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.ensureCondLocked()
	if c.closed {
		return 0, false
	}
	if c.cancels == nil {
		c.cancels = map[int]context.CancelFunc{}
	}
	id := c.nextID
	c.nextID++
	c.active++
	c.cancels[id] = cancel
	return id, true
}

func (c *sharedGatewayClient) endRequest(id int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.ensureCondLocked()
	delete(c.cancels, id)
	if c.active > 0 {
		c.active--
	}
	if c.active == 0 {
		c.cond.Broadcast()
	}
}

func (c *sharedGatewayClient) isClosed() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}

func (c *sharedGatewayClient) ensureCondLocked() {
	if c.cond == nil {
		c.cond = sync.NewCond(&c.mu)
	}
}

func endpointSwitchingError() error {
	return facade.NewCodedError(facade.CodeEndpointSwitching, "runtime endpoint is switching", http.StatusServiceUnavailable)
}

func newGatewayClient(endpoint runtimestate.RemoteEndpoint) *shared.Client {
	return shared.NewClient(shared.Endpoint{
		URL:       gatewayWebSocketURL(endpoint.URL),
		Token:     endpoint.Token,
		TLSVerify: endpoint.TLSVerify,
	})
}
