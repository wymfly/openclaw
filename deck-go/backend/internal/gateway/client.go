package gateway

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strconv"
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

type healthProbeClientEntry struct {
	client   *Client
	failures atomic.Int32
}

func newHealthProbeClientEntry(upstreamURL string, token string) *healthProbeClientEntry {
	return &healthProbeClientEntry{
		client: NewClient(staticConnectionProvider{upstreamURL: upstreamURL, token: token}),
	}
}

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
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

type frameType string

const (
	frameTypeReq   frameType = "req"
	frameTypeRes   frameType = "res"
	frameTypeEvent frameType = "event"
)

type frame struct {
	Type    frameType      `json:"type"`
	ID      string         `json:"id,omitempty"`
	Event   string         `json:"event,omitempty"`
	Method  string         `json:"method,omitempty"`
	Params  any            `json:"params,omitempty"`
	Payload any            `json:"payload,omitempty"`
	Error   *responseError `json:"error,omitempty"`
}

type Client struct {
	realtime *Realtime
}

type DirectRequestOptions struct {
	Headers               http.Header
	HandshakeTimeout      time.Duration
	InsecureSkipTLSVerify bool
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
	dialer := websocket.Dialer{HandshakeTimeout: handshakeTimeout}
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
		Type:   frameTypeReq,
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
		if fr.Type != frameTypeRes || fr.ID != reqID {
			continue
		}
		if fr.Error != nil {
			return nil, FromEnvelope(fr.Error)
		}
		return fr.Payload, nil
	}
}

func (c *Client) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	if c.realtime == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	return c.realtime.Request(ctx, method, params)
}

func (c *Client) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	if c.realtime == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	return c.realtime.RequestTyped(ctx, method, params)
}

func (c *Client) BridgeFrame(ctx context.Context, raw []byte, idPrefix string) ([]byte, error) {
	if c.realtime == nil {
		return nil, errors.New("gateway connection provider is not configured")
	}
	return c.realtime.BridgeFrame(ctx, raw, idPrefix)
}

func (c *Client) ProbeHealth(ctx context.Context) error {
	_, err := c.Request(ctx, "health", nil)
	return err
}

func (c *Client) Close() error {
	if c == nil || c.realtime == nil {
		return nil
	}
	return c.realtime.Close()
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
	value, loaded := healthProbeClients.Load(key)
	if !loaded {
		candidate := newHealthProbeClientEntry(upstreamURL, token)
		value, loaded = healthProbeClients.LoadOrStore(key, candidate)
		if loaded {
			closeProbeClientEntry(candidate)
		}
	}
	entry := value.(*healthProbeClientEntry)
	err := entry.client.ProbeHealth(ctx)
	if err != nil {
		if entry.failures.Add(1) >= int32(healthProbeFailureThreshold()) {
			evictProbeClient(key, entry)
		}
		return err
	}
	entry.failures.Store(0)
	return nil
}

func healthProbeClientKey(upstreamURL string, token string) string {
	tokenHash := sha256.Sum256([]byte(token))
	return upstreamURL + "\x00" + hex.EncodeToString(tokenHash[:])
}

func normalizeFrameParams(params any) any {
	if params == nil {
		return nil
	}
	if paramsMap, ok := params.(map[string]any); ok && len(paramsMap) == 0 {
		return nil
	}
	return params
}

func healthProbeFailureThreshold() int {
	const defaultThreshold = 5
	raw := strings.TrimSpace(os.Getenv("GATEWAY_PROBE_FAILURE_THRESHOLD"))
	if raw == "" {
		return defaultThreshold
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return defaultThreshold
	}
	return value
}

func InvalidateProbeClient(upstreamURL string, token string) {
	upstreamURL = strings.TrimSpace(upstreamURL)
	token = strings.TrimSpace(token)
	if upstreamURL == "" || token == "" {
		return
	}
	key := healthProbeClientKey(upstreamURL, token)
	value, loaded := healthProbeClients.LoadAndDelete(key)
	if !loaded {
		return
	}
	closeProbeClientEntry(value)
}

func ShutdownProbeClients() {
	healthProbeClients.Range(func(key any, value any) bool {
		healthProbeClients.Delete(key)
		closeProbeClientEntry(value)
		return true
	})
}

func evictProbeClient(key string, entry *healthProbeClientEntry) {
	if healthProbeClients.CompareAndDelete(key, entry) {
		closeProbeClientEntry(entry)
	}
}

func closeProbeClientEntry(value any) {
	entry, ok := value.(*healthProbeClientEntry)
	if !ok || entry.client == nil || entry.client.realtime == nil {
		return
	}
	_ = entry.client.realtime.Close()
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
		if fr.Type == frameTypeEvent && fr.Event == "connect.challenge" {
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
			payloadMap, ok := fr.Payload.(map[string]any)
			if !ok {
				return fmt.Errorf("gateway connect: nonce payload is not object: %T", fr.Payload)
			}
			nonce, ok := payloadMap["nonce"].(string)
			if !ok || strings.TrimSpace(nonce) == "" {
				return errors.New("gateway connect: nonce missing or non-string in challenge payload")
			}
			trimmedNonce := strings.TrimSpace(nonce)
			identity, err := loadOrCreateDeviceIdentity()
			if err != nil {
				return fmt.Errorf("gateway connect: device identity unavailable: %w", err)
			}
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
			if signErr != nil || keyErr != nil {
				return fmt.Errorf("gateway connect: device signing failed: signErr=%v keyErr=%v", signErr, keyErr)
			}
			params["device"] = map[string]any{
				"id":        identity.deviceID,
				"publicKey": publicKey,
				"signature": signature,
				"signedAt":  signedAtMS,
				"nonce":     trimmedNonce,
			}
			connectID := nextID()
			if err := conn.WriteJSON(frame{
				Type:   frameTypeReq,
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
				if connectResp.Type != frameTypeRes || connectResp.ID != connectID {
					continue
				}
				if connectResp.Error != nil {
					return FromEnvelope(connectResp.Error)
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
