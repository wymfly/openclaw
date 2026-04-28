package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

var ErrConnectionLost = errors.New("gateway realtime connection lost")

type Realtime struct {
	provider ConnectionProvider
	bus      *events.Bus

	mu                  sync.Mutex
	writeMu             sync.Mutex
	conn                *websocket.Conn
	connectInProgress   chan struct{}
	connectErr          error
	connectCancel       context.CancelFunc
	reconnectInProgress bool
	closeCh             chan struct{}
	closed              bool
	pending             map[string]chan responseResult
	lifecycleSubscribed bool
	sessionSubs         map[string]struct{}
}

type responseResult struct {
	payload any
	err     error
}

func NewRealtime(provider ConnectionProvider, bus *events.Bus) *Realtime {
	if bus == nil {
		bus = events.NewNoopBus()
	}
	return &Realtime{
		provider:    provider,
		bus:         bus,
		closeCh:     make(chan struct{}),
		pending:     map[string]chan responseResult{},
		sessionSubs: map[string]struct{}{},
	}
}

func (r *Realtime) SubscribeSession(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("session key is required")
	}
	if err := r.ensureConnected(ctx); err != nil {
		return err
	}

	r.mu.Lock()
	_, alreadySubscribed := r.sessionSubs[key]
	lifecycleSubscribed := r.lifecycleSubscribed
	r.mu.Unlock()

	if !lifecycleSubscribed {
		if _, err := r.doRequest(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			return err
		}
		r.mu.Lock()
		r.lifecycleSubscribed = true
		r.mu.Unlock()
	}
	if alreadySubscribed {
		return nil
	}
	if _, err := r.doRequest(ctx, "sessions.messages.subscribe", map[string]any{"key": key}); err != nil {
		return err
	}
	r.mu.Lock()
	r.sessionSubs[key] = struct{}{}
	r.mu.Unlock()
	return nil
}

func (r *Realtime) UnsubscribeSession(ctx context.Context, key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("session key is required")
	}
	if err := r.ensureConnected(ctx); err != nil {
		return err
	}

	r.mu.Lock()
	_, subscribed := r.sessionSubs[key]
	r.mu.Unlock()
	if !subscribed {
		return nil
	}
	if _, err := r.doRequest(ctx, "sessions.messages.unsubscribe", map[string]any{"key": key}); err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.sessionSubs, key)
	r.mu.Unlock()
	return nil
}

func (r *Realtime) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if strings.TrimSpace(method) == "" {
		return nil, errors.New("gateway method is required")
	}
	if err := r.ensureConnected(ctx); err != nil {
		return nil, err
	}
	return r.doRequest(ctx, method, params)
}

func (r *Realtime) ensureConnected(ctx context.Context) error {
	for {
		r.mu.Lock()
		if r.closed {
			r.mu.Unlock()
			return ErrConnectionLost
		}
		if wait := r.connectInProgress; wait != nil {
			r.mu.Unlock()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-wait:
			}
			r.mu.Lock()
			err := r.connectErr
			connected := r.conn != nil
			r.mu.Unlock()
			if connected {
				return nil
			}
			if err != nil {
				return err
			}
			continue
		}
		if r.conn != nil {
			r.mu.Unlock()
			return nil
		}

		wait := make(chan struct{})
		connectCtx, cancel := context.WithCancel(ctx)
		r.connectInProgress = wait
		r.connectErr = nil
		r.connectCancel = cancel
		r.mu.Unlock()

		conn, err := r.connect(connectCtx)
		cancel()

		if err == nil {
			r.mu.Lock()
			if r.closed {
				err = ErrConnectionLost
				_ = conn.Close()
				conn = nil
			} else {
				r.conn = conn
				r.pending = map[string]chan responseResult{}
			}
			r.mu.Unlock()
		}
		if err == nil {
			go r.readLoop(conn)
			if restoreErr := r.restoreSubscriptions(ctx); restoreErr != nil {
				r.closeConnection(conn, ErrConnectionLost)
				err = restoreErr
			}
		}

		r.mu.Lock()
		r.connectErr = err
		r.connectInProgress = nil
		r.connectCancel = nil
		close(wait)
		r.mu.Unlock()

		return err
	}
}

func (r *Realtime) connect(ctx context.Context) (*websocket.Conn, error) {
	if r.provider == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	upstreamURL, token, ok := r.provider.GatewayConnection()
	if !ok {
		return nil, errors.New("managed gateway connection is not configured")
	}

	dialer := websocket.Dialer{HandshakeTimeout: 8 * time.Second}
	conn, _, err := dialer.DialContext(ctx, upstreamURL, http.Header{})
	if err != nil {
		return nil, err
	}

	if err := completeConnect(ctx, conn, token, "gateway-client"); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return conn, nil
}

func (r *Realtime) restoreSubscriptions(ctx context.Context) error {
	r.mu.Lock()
	needsLifecycle := r.lifecycleSubscribed
	sessionKeys := make([]string, 0, len(r.sessionSubs))
	for key := range r.sessionSubs {
		sessionKeys = append(sessionKeys, key)
	}
	r.mu.Unlock()

	if needsLifecycle || len(sessionKeys) > 0 {
		if _, err := r.doRequest(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			return err
		}
		r.mu.Lock()
		r.lifecycleSubscribed = true
		r.mu.Unlock()
	}
	for _, key := range sessionKeys {
		if _, err := r.doRequest(ctx, "sessions.messages.subscribe", map[string]any{"key": key}); err != nil {
			return err
		}
	}
	return nil
}

func (r *Realtime) doRequest(ctx context.Context, method string, params map[string]any) (any, error) {
	r.mu.Lock()
	conn := r.conn
	r.mu.Unlock()
	if conn == nil {
		return nil, ErrConnectionLost
	}
	if params == nil {
		params = map[string]any{}
	}

	id := nextID()
	ch := make(chan responseResult, 1)

	r.mu.Lock()
	r.pending[id] = ch
	r.mu.Unlock()

	r.writeMu.Lock()
	err := conn.WriteJSON(frame{
		Type:   "req",
		ID:     id,
		Method: method,
		Params: params,
	})
	r.writeMu.Unlock()
	if err != nil {
		r.mu.Lock()
		delete(r.pending, id)
		r.mu.Unlock()
		r.closeConnection(conn, ErrConnectionLost)
		return nil, err
	}

	select {
	case <-ctx.Done():
		r.mu.Lock()
		delete(r.pending, id)
		r.mu.Unlock()
		return nil, ctx.Err()
	case result := <-ch:
		return result.payload, result.err
	}
}

func (r *Realtime) readLoop(conn *websocket.Conn) {
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			r.closeConnection(conn, ErrConnectionLost)
			return
		}
		var fr frame
		if err := json.Unmarshal(raw, &fr); err != nil {
			continue
		}
		switch fr.Type {
		case "res":
			r.mu.Lock()
			ch := r.pending[fr.ID]
			delete(r.pending, fr.ID)
			r.mu.Unlock()
			if ch != nil {
				if fr.Error != nil {
					ch <- responseResult{err: fmt.Errorf("%s: %s", fr.Error.Code, fr.Error.Message)}
				} else {
					ch <- responseResult{payload: fr.Payload}
				}
			}
		case "event":
			if fr.Event == "connect.challenge" {
				continue
			}
			payload, _ := json.Marshal(fr.Payload)
			r.bus.Publish(fr.Event, payload)
		}
	}
}

func (r *Realtime) closeConnection(conn *websocket.Conn, err error) {
	r.mu.Lock()
	shouldReconnect := false
	if r.conn == conn {
		r.conn = nil
		shouldReconnect = !r.closed
	}
	for id, ch := range r.pending {
		ch <- responseResult{err: err}
		delete(r.pending, id)
	}
	r.lifecycleSubscribed = false
	r.mu.Unlock()
	_ = conn.Close()
	if shouldReconnect {
		r.startReconnectLoop()
	}
}

func (r *Realtime) Close() error {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return nil
	}
	r.closed = true
	close(r.closeCh)
	cancel := r.connectCancel
	conn := r.conn
	r.conn = nil
	for id, ch := range r.pending {
		ch <- responseResult{err: ErrConnectionLost}
		delete(r.pending, id)
	}
	r.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if conn != nil {
		return conn.Close()
	}
	return nil
}

func (r *Realtime) startReconnectLoop() {
	r.mu.Lock()
	if r.closed || r.reconnectInProgress {
		r.mu.Unlock()
		return
	}
	r.reconnectInProgress = true
	r.mu.Unlock()

	go func() {
		defer func() {
			r.mu.Lock()
			r.reconnectInProgress = false
			r.mu.Unlock()
		}()
		for attempt := 0; ; attempt++ {
			delay := reconnectDelay(attempt)
			timer := time.NewTimer(delay)
			select {
			case <-timer.C:
			case <-r.closeCh:
				timer.Stop()
				return
			}

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := r.ensureConnected(ctx)
			cancel()
			if err == nil {
				return
			}

			select {
			case <-r.closeCh:
				return
			default:
			}
		}
	}()
}

func reconnectDelay(attempt int) time.Duration {
	delays := []time.Duration{
		time.Second,
		2 * time.Second,
		4 * time.Second,
		8 * time.Second,
		16 * time.Second,
		30 * time.Second,
	}
	if attempt < 0 {
		attempt = 0
	}
	if attempt >= len(delays) {
		return 30 * time.Second
	}
	return delays[attempt]
}
