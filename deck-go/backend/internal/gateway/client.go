package gateway

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

const (
	protocolVersion = 3
)

var requestCounter uint64

type ConnectionProvider interface {
	GatewayConnection() (string, string, bool)
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
	provider ConnectionProvider
}

type DirectRequestOptions struct {
	Headers               http.Header
	HandshakeTimeout      time.Duration
	InsecureSkipTLSVerify bool
}

func New(provider ConnectionProvider) *Client {
	return &Client{provider: provider}
}

func (c *Client) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if c.provider == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	url, token, ok := c.provider.GatewayConnection()
	if !ok {
		return nil, errors.New("managed gateway connection is not configured")
	}
	return RequestDirect(ctx, url, token, method, params)
}

func RequestDirect(ctx context.Context, upstreamURL string, token string, method string, params map[string]any) (any, error) {
	return RequestDirectWithOptions(ctx, upstreamURL, token, method, params, DirectRequestOptions{})
}

func RequestDirectWithOptions(ctx context.Context, upstreamURL string, token string, method string, params map[string]any, opts DirectRequestOptions) (any, error) {
	if strings.TrimSpace(upstreamURL) == "" {
		return nil, errors.New("gateway url is not configured")
	}
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("gateway token is not configured")
	}

	handshakeTimeout := opts.HandshakeTimeout
	if handshakeTimeout <= 0 {
		handshakeTimeout = 8 * time.Second
	}
	dialer := websocket.Dialer{
		HandshakeTimeout: handshakeTimeout,
	}
	if opts.InsecureSkipTLSVerify {
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}
	headers := opts.Headers.Clone()
	if headers == nil {
		headers = http.Header{}
	}
	headers.Set("Authorization", "Bearer "+token)
	conn, _, err := dialer.DialContext(ctx, upstreamURL, headers)
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
	_, err := RequestDirect(ctx, upstreamURL, token, "health", map[string]any{})
	return err
}

func completeConnect(ctx context.Context, conn *websocket.Conn, token string, clientID string) error {
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
