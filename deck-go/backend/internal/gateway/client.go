package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
)

const (
	protocolVersion = 3
)

var requestCounter uint64

type responseError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type frame struct {
	Type   string         `json:"type"`
	ID     string         `json:"id,omitempty"`
	Event  string         `json:"event,omitempty"`
	Method string         `json:"method,omitempty"`
	Params map[string]any `json:"params,omitempty"`
	Payload any           `json:"payload,omitempty"`
	Error  *responseError `json:"error,omitempty"`
}

type Client struct {
	store *config.Store
}

func New(store *config.Store) *Client {
	return &Client{store: store}
}

func (c *Client) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	settings := c.store.Effective()
	if strings.TrimSpace(settings.GatewayURL) == "" {
		return nil, errors.New("gateway url is not configured")
	}
	if strings.TrimSpace(settings.GatewayToken) == "" {
		return nil, errors.New("gateway token is not configured")
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 8 * time.Second,
	}
	conn, _, err := dialer.DialContext(ctx, settings.GatewayURL, http.Header{})
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if err := c.completeConnect(ctx, conn, settings.GatewayToken); err != nil {
		return nil, err
	}

	reqID := nextID()
	if err := conn.WriteJSON(frame{
		Type:   "req",
		ID:     reqID,
		Method: method,
		Params: params,
	}); err != nil {
		return nil, err
	}

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return nil, err
		}
		var fr frame
		if err := json.Unmarshal(raw, &fr); err != nil {
			continue
		}
		if fr.Type != "res" || fr.ID != reqID {
			continue
		}
		if fr.Error != nil {
			return nil, fmt.Errorf("%s: %s", fr.Error.Code, fr.Error.Message)
		}
		return fr.Payload, nil
	}
}

func (c *Client) completeConnect(ctx context.Context, conn *websocket.Conn, token string) error {
	challengeID := nextID()
	_ = challengeID
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
						"id":       "gateway-client",
						"version":  "deck-go-dev",
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

func nextID() string {
	value := atomic.AddUint64(&requestCounter, 1)
	return fmt.Sprintf("%d", value)
}

func ResolveOrigin(upstreamURL string) string {
	u, err := url.Parse(upstreamURL)
	if err != nil {
		return ""
	}
	if u.Scheme == "wss" {
		u.Scheme = "https"
	} else if u.Scheme == "ws" {
		u.Scheme = "http"
	}
	return u.String()
}

