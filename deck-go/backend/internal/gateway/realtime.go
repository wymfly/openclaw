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
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type Realtime struct {
	store *config.Store
	bus   *events.Bus

	mu                  sync.Mutex
	writeMu             sync.Mutex
	conn                *websocket.Conn
	pending             map[string]chan responseResult
	lifecycleSubscribed bool
	sessionSubs         map[string]struct{}
}

type responseResult struct {
	payload any
	err     error
}

func NewRealtime(store *config.Store, bus *events.Bus) *Realtime {
	return &Realtime{
		store:      store,
		bus:        bus,
		pending:    map[string]chan responseResult{},
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
		if _, err := r.request(ctx, "sessions.subscribe", map[string]any{}); err != nil {
			return err
		}
		r.mu.Lock()
		r.lifecycleSubscribed = true
		r.mu.Unlock()
	}
	if alreadySubscribed {
		return nil
	}
	if _, err := r.request(ctx, "sessions.messages.subscribe", map[string]any{"key": key}); err != nil {
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
	if _, err := r.request(ctx, "sessions.messages.unsubscribe", map[string]any{"key": key}); err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.sessionSubs, key)
	r.mu.Unlock()
	return nil
}

func (r *Realtime) ensureConnected(ctx context.Context) error {
	r.mu.Lock()
	if r.conn != nil {
		r.mu.Unlock()
		return nil
	}
	r.mu.Unlock()

	settings := r.store.Effective()
	if strings.TrimSpace(settings.GatewayURL) == "" {
		return errors.New("gateway url is not configured")
	}
	if strings.TrimSpace(settings.GatewayToken) == "" {
		return errors.New("gateway token is not configured")
	}

	dialer := websocket.Dialer{HandshakeTimeout: 8 * time.Second}
	conn, _, err := dialer.DialContext(ctx, settings.GatewayURL, http.Header{})
	if err != nil {
		return err
	}

	if err := r.completeConnect(ctx, conn, settings.GatewayToken); err != nil {
		conn.Close()
		return err
	}

	r.mu.Lock()
	r.conn = conn
	r.pending = map[string]chan responseResult{}
	r.mu.Unlock()

	go r.readLoop(conn)
	return nil
}

func (r *Realtime) completeConnect(ctx context.Context, conn *websocket.Conn, token string) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		var fr frame
		if err := json.Unmarshal(raw, &fr); err != nil {
			continue
		}
		if fr.Type == "event" && fr.Event == "connect.challenge" {
			connectID := nextID()
			if err := conn.WriteJSON(frame{
				Type:   "req",
				ID:     connectID,
				Method: "connect",
				Params: map[string]any{
					"minProtocol": protocolVersion,
					"maxProtocol": protocolVersion,
					"client": map[string]any{
						"id":       "deck-go-backend",
						"version":  "dev",
						"platform": "node",
						"mode":     "backend",
					},
					"role": "operator",
					"scopes": []string{
						"operator.admin",
						"operator.read",
						"operator.write",
						"operator.approvals",
						"operator.pairing",
					},
					"caps": []string{"tool-events"},
					"auth": map[string]any{
						"token": token,
					},
				},
			}); err != nil {
				return err
			}

			for {
				select {
				case <-ctx.Done():
					return ctx.Err()
				default:
				}
				_, connectRaw, err := conn.ReadMessage()
				if err != nil {
					return err
				}
				var connectResp frame
				if err := json.Unmarshal(connectRaw, &connectResp); err != nil {
					continue
				}
				if connectResp.Type != "res" || connectResp.ID != connectID {
					continue
				}
				if connectResp.Error != nil {
					return fmt.Errorf("%s: %s", connectResp.Error.Code, connectResp.Error.Message)
				}
				return nil
			}
		}
	}
}

func (r *Realtime) request(ctx context.Context, method string, params map[string]any) (any, error) {
	r.mu.Lock()
	conn := r.conn
	r.mu.Unlock()
	if conn == nil {
		return nil, errors.New("gateway realtime connection is not ready")
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
			r.closeConnection(conn, err)
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
	if r.conn == conn {
		r.conn = nil
	}
	for id, ch := range r.pending {
		ch <- responseResult{err: err}
		delete(r.pending, id)
	}
	r.lifecycleSubscribed = false
	r.sessionSubs = map[string]struct{}{}
	r.mu.Unlock()
	_ = conn.Close()
}

