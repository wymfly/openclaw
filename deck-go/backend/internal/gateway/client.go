package gateway

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

const (
	protocolVersion = 3
)

var requestCounter uint64
var healthProbeClients sync.Map

type ConnectionProvider interface {
	GatewayConnection() (string, string, bool)
}

type staticConnectionProvider struct {
	upstreamURL string
	token       string
}

func (p staticConnectionProvider) GatewayConnection() (string, string, bool) {
	return p.upstreamURL, p.token, strings.TrimSpace(p.upstreamURL) != "" && strings.TrimSpace(p.token) != ""
}

type responseError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type frame struct {
	Type    string         `json:"type"`
	ID      string         `json:"id,omitempty"`
	Event   string         `json:"event,omitempty"`
	Method  string         `json:"method,omitempty"`
	Params  map[string]any `json:"params,omitempty"`
	Payload any            `json:"payload,omitempty"`
	Error   *responseError `json:"error,omitempty"`
}

type Client struct {
	realtime *Realtime
}

func New(provider ConnectionProvider) *Client {
	return NewClient(provider)
}

func NewClient(provider ConnectionProvider) *Client {
	return &Client{
		realtime: NewRealtime(provider, events.NewNoopBus()),
	}
}

func NewClientWithRealtime(realtime *Realtime) *Client {
	return &Client{realtime: realtime}
}

func (c *Client) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if c.realtime == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	return c.realtime.Request(ctx, method, params)
}

func (c *Client) ProbeHealth(ctx context.Context) error {
	_, err := c.Request(ctx, "health", nil)
	return err
}

// Deprecated: prefer Client.Request via Realtime so calls share one Gateway connection.
func RequestDirect(ctx context.Context, upstreamURL string, token string, method string, params map[string]any) (any, error) {
	if strings.TrimSpace(upstreamURL) == "" {
		return nil, errors.New("gateway url is not configured")
	}
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("gateway token is not configured")
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 8 * time.Second,
	}
	conn, _, err := dialer.DialContext(ctx, upstreamURL, http.Header{})
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	if err := completeConnect(ctx, conn, token, "gateway-client"); err != nil {
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

func ProbeHealth(ctx context.Context, upstreamURL string, token string) error {
	upstreamURL = strings.TrimSpace(upstreamURL)
	token = strings.TrimSpace(token)
	if upstreamURL == "" {
		return errors.New("gateway url is not configured")
	}
	if token == "" {
		return errors.New("gateway token is not configured")
	}

	key := healthProbeClientKey(upstreamURL, token)
	value, _ := healthProbeClients.LoadOrStore(
		key,
		NewClient(staticConnectionProvider{upstreamURL: upstreamURL, token: token}),
	)
	return value.(*Client).ProbeHealth(ctx)
}

func healthProbeClientKey(upstreamURL string, token string) string {
	tokenHash := sha256.Sum256([]byte(token))
	return upstreamURL + "\x00" + hex.EncodeToString(tokenHash[:])
}

func completeConnect(ctx context.Context, conn *websocket.Conn, token string, clientID string) error {
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = conn.Close()
		case <-done:
		}
	}()
	defer close(done)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		_, raw, err := conn.ReadMessage()
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return err
		}
		var fr frame
		if err := json.Unmarshal(raw, &fr); err != nil {
			continue
		}
		if fr.Type == "event" && fr.Event == "connect.challenge" {
			scopes := []string{
				"operator.admin",
				"operator.read",
				"operator.write",
				"operator.approvals",
				"operator.pairing",
			}
			params := map[string]any{
				"minProtocol": protocolVersion,
				"maxProtocol": protocolVersion,
				"client": map[string]any{
					"id":       clientID,
					"version":  "deck-go-dev",
					"platform": runtime.GOOS,
					"mode":     "backend",
				},
				"role":   "operator",
				"scopes": scopes,
				"caps":   []string{"tool-events"},
				"auth": map[string]any{
					"token": token,
				},
			}
			payloadMap, _ := fr.Payload.(map[string]any)
			nonce, _ := payloadMap["nonce"].(string)
			if trimmedNonce := strings.TrimSpace(nonce); trimmedNonce != "" {
				if identity, err := loadOrCreateDeviceIdentity(); err == nil {
					signedAtMS := time.Now().UnixMilli()
					payload := buildDeviceAuthPayloadV3(struct {
						deviceID   string
						clientID   string
						clientMode string
						role       string
						scopes     []string
						signedAtMS int64
						token      string
						nonce      string
					}{
						deviceID:   identity.deviceID,
						clientID:   clientID,
						clientMode: "backend",
						role:       "operator",
						scopes:     scopes,
						signedAtMS: signedAtMS,
						token:      token,
						nonce:      trimmedNonce,
					})
					signature, signErr := signDevicePayload(identity.privateKeyPEM, payload)
					publicKey, keyErr := publicKeyRawBase64URLFromPEM(identity.publicKeyPEM)
					if signErr == nil && keyErr == nil {
						params["device"] = map[string]any{
							"id":        identity.deviceID,
							"publicKey": publicKey,
							"signature": signature,
							"signedAt":  signedAtMS,
							"nonce":     trimmedNonce,
						}
					}
				}
			}
			connectID := nextID()
			if err := conn.WriteJSON(frame{
				Type:   "req",
				ID:     connectID,
				Method: "connect",
				Params: params,
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
					if ctx.Err() != nil {
						return ctx.Err()
					}
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
