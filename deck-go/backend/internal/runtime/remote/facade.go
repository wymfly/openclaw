package remote

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/envconf"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/shared"
	runtimestate "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/state"
)

const (
	remoteDescribeMethod         = "gateway.describe"
	remoteEndpointSwitchDrainTTL = 5 * time.Second
	tokenUnchangedSentinel       = "__unchanged__"
)

type Facade struct {
	defaults        envconf.RuntimeRemoteDefaults
	store           *runtimestate.Store
	connState       *RemoteState
	mu              sync.RWMutex
	active          gatewayClient
	newClient       func(runtimestate.RemoteEndpoint) gatewayClient
	drainTimeout    time.Duration
	terminateStream func(eventName string, streamID string)
}

func New(defaults envconf.RuntimeRemoteDefaults, store *runtimestate.Store) *Facade {
	return &Facade{
		defaults:     defaults,
		store:        store,
		connState:    NewRemoteState(),
		newClient:    newRuntimeGatewayClient,
		drainTimeout: remoteEndpointSwitchDrainTTL,
	}
}

func (f *Facade) Capabilities(ctx context.Context) (facade.Capabilities, error) {
	configured := f.configured()
	if configured {
		if err := f.ensureConnected(ctx); err != nil {
			configured = false
		}
	}
	return facade.Capabilities{
		Mode:            string(envconf.ModeRemote),
		Configured:      configured,
		EndpointMutable: true,
		SupervisorState: false,
	}, nil
}

func (f *Facade) Endpoint(context.Context) (facade.EndpointView, error) {
	endpoint, source, err := f.activeEndpoint()
	if err != nil {
		return facade.EndpointView{}, err
	}
	return endpointView(endpoint.URL, endpoint.Token, endpoint.TLSVerify, source), nil
}

func (f *Facade) GatewayConnection(context.Context) (facade.GatewayConnection, error) {
	endpoint, _, err := f.activeEndpoint()
	if err != nil {
		return facade.GatewayConnection{}, err
	}
	if !validEndpointURL(endpoint.URL) || strings.TrimSpace(endpoint.Token) == "" {
		return facade.GatewayConnection{}, facade.ErrNotConfigured
	}
	return facade.GatewayConnection{
		URL:       endpoint.URL,
		Token:     endpoint.Token,
		TLSVerify: endpoint.TLSVerify,
	}, nil
}

func (f *Facade) UpdateRemoteEndpoint(ctx context.Context, input facade.RemoteEndpointInput) (facade.EndpointView, error) {
	remote, err := f.remoteEndpointFromInput(input)
	if err != nil {
		return facade.EndpointView{}, err
	}
	if f.store == nil {
		return facade.EndpointView{}, facade.ErrNotConfigured
	}
	candidate := f.newClient(remote)
	if candidate == nil {
		return facade.EndpointView{}, facade.NewCodedError(facade.CodeGatewayUnreachable, "remote gateway client is not configured", http.StatusBadGateway)
	}
	if _, err := candidate.Request(ctx, remoteDescribeMethod, map[string]any{}); err != nil {
		_ = candidate.Close()
		return facade.EndpointView{}, gatewayDescribeError(err)
	}
	if err := f.store.WriteRemote(remote); err != nil {
		_ = candidate.Close()
		return facade.EndpointView{}, err
	}
	old := f.swapActiveClient(candidate)
	f.connState.markConnected()
	f.drainTransition(ctx, old, candidate, facade.StreamEventEndpointSwitched)
	return endpointView(remote.URL, remote.Token, remote.TLSVerify, "json"), nil
}

func (f *Facade) TestRemoteEndpoint(ctx context.Context, input *facade.RemoteEndpointInput) (facade.TestResult, error) {
	endpoint, err := f.endpointForTest(input)
	if err != nil {
		return facade.TestResult{}, err
	}
	started := time.Now()
	candidate := f.newClient(endpoint)
	if candidate == nil {
		return facade.TestResult{
			OK:          false,
			TLSVerified: endpoint.TLSVerify,
			Error:       "remote gateway client is not configured",
		}, nil
	}
	defer func() {
		_ = candidate.Close()
	}()
	payload, err := candidate.Request(ctx, remoteDescribeMethod, map[string]any{})
	latencyMs := float64(time.Since(started).Microseconds()) / 1000
	if err != nil {
		return facade.TestResult{
			OK:          false,
			LatencyMs:   latencyMs,
			TLSVerified: endpoint.TLSVerify,
			Error:       err.Error(),
		}, nil
	}
	version := ""
	if payloadMap, ok := payload.(map[string]any); ok {
		if raw, ok := payloadMap["gatewayVersion"].(string); ok {
			version = raw
		} else if raw, ok := payloadMap["version"].(string); ok {
			version = raw
		}
	}
	return facade.TestResult{
		OK:             true,
		LatencyMs:      latencyMs,
		GatewayVersion: version,
		TLSVerified:    endpoint.TLSVerify,
	}, nil
}

func (f *Facade) RuntimeGatewayStatus(context.Context) (facade.RuntimeStatus, error) {
	if !f.configured() {
		return facade.RuntimeStatus{}, facade.ErrNotConfigured
	}
	endpoint, _, err := f.activeEndpoint()
	if err != nil {
		return facade.RuntimeStatus{}, err
	}
	snapshot := f.connState.Snapshot()
	lastConnectedAt := ""
	if snapshot.LastConnectedAt != nil {
		lastConnectedAt = snapshot.LastConnectedAt.UTC().Format(time.RFC3339)
	}
	lastError := snapshot.LastError
	latencyP50 := 0
	tlsVerified := endpoint.TLSVerify
	status, health := remoteLifecycle(snapshot.Status, lastError)
	return facade.RuntimeStatus{
		Mode:            string(envconf.ModeRemote),
		Configured:      true,
		Status:          status,
		Health:          health,
		GatewayURL:      endpoint.URL,
		LastConnectedAt: &lastConnectedAt,
		LastError:       &lastError,
		LatencyP50:      &latencyP50,
		TLSVerified:     &tlsVerified,
		AutoStart:       false,
	}, nil
}

func remoteLifecycle(status RemoteConnectionStatus, lastError string) (string, string) {
	switch status {
	case RemoteConnectionConnected:
		return "running", "healthy"
	case RemoteConnectionConnecting:
		return "starting", "unknown"
	case RemoteConnectionError:
		return "failed", "unhealthy"
	default:
		if strings.TrimSpace(lastError) != "" {
			return "failed", "unhealthy"
		}
		return "stopped", "unknown"
	}
}

func (f *Facade) Start(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *Facade) Stop(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *Facade) Restart(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *Facade) Install(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *Facade) Reinstall(context.Context) (facade.RuntimeStatus, error) {
	return facade.RuntimeStatus{}, facade.ErrUnsupported
}

func (f *Facade) ReloadRuntime(ctx context.Context) (facade.RuntimeStatus, error) {
	endpoint, _, err := f.activeEndpoint()
	if err != nil {
		return facade.RuntimeStatus{}, err
	}
	if !validEndpointURL(endpoint.URL) || strings.TrimSpace(endpoint.Token) == "" {
		return facade.RuntimeStatus{}, facade.ErrNotConfigured
	}
	next := f.newClient(endpoint)
	if next == nil {
		return facade.RuntimeStatus{}, facade.NewCodedError(facade.CodeGatewayUnreachable, "remote gateway client is not configured", http.StatusBadGateway)
	}
	if _, err := next.Request(ctx, remoteDescribeMethod, map[string]any{}); err != nil {
		_ = next.Close()
		mapped := gatewayDescribeError(err)
		f.connState.markError(mapped)
		return facade.RuntimeStatus{}, mapped
	}
	old := f.swapActiveClient(next)
	f.connState.markConnected()
	f.drainTransition(ctx, old, next, facade.StreamEventReconnectRequested)
	return f.RuntimeGatewayStatus(ctx)
}

func (f *Facade) Request(ctx context.Context, method string, params map[string]any) (any, error) {
	return f.request(ctx, method, params)
}

func (f *Facade) RequestTyped(ctx context.Context, method string, params any) (any, error) {
	paramsMap, err := requestParamsToMap(params)
	if err != nil {
		return nil, err
	}
	return f.request(ctx, method, paramsMap)
}

func requestParamsToMap(params any) (map[string]any, error) {
	if params == nil {
		return map[string]any{}, nil
	}
	if paramsMap, ok := params.(map[string]any); ok {
		if paramsMap == nil {
			return map[string]any{}, nil
		}
		return paramsMap, nil
	}
	raw, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	if string(raw) == "null" {
		return map[string]any{}, nil
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out == nil {
		return map[string]any{}, nil
	}
	return out, nil
}

func (f *Facade) ensureConnected(ctx context.Context) error {
	snapshot := f.connState.Snapshot()
	if snapshot.Status == RemoteConnectionConnected {
		return nil
	}
	client, err := f.activeClient()
	if err != nil {
		f.connState.markError(err)
		return err
	}
	if _, err := client.Request(ctx, remoteDescribeMethod, map[string]any{}); err != nil {
		mapped := gatewayDescribeError(err)
		f.connState.markError(mapped)
		return mapped
	}
	f.connState.markConnected()
	return nil
}

func (f *Facade) request(ctx context.Context, method string, params map[string]any) (any, error) {
	client, err := f.activeClient()
	if err != nil {
		return nil, err
	}
	return client.Request(ctx, method, params)
}

func (f *Facade) activeClient() (gatewayClient, error) {
	f.mu.RLock()
	active := f.active
	f.mu.RUnlock()
	if active != nil {
		return active, nil
	}

	endpoint, _, err := f.activeEndpoint()
	if err != nil {
		return nil, err
	}
	if !validEndpointURL(endpoint.URL) || strings.TrimSpace(endpoint.Token) == "" {
		return nil, facade.ErrNotConfigured
	}
	next := f.newClient(endpoint)
	if next == nil {
		return nil, facade.NewCodedError(facade.CodeGatewayUnreachable, "remote gateway client is not configured", http.StatusBadGateway)
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	if f.active != nil {
		_ = next.Close()
		return f.active, nil
	}
	f.active = next
	return f.active, nil
}

func (f *Facade) swapActiveClient(next gatewayClient) gatewayClient {
	f.mu.Lock()
	defer f.mu.Unlock()
	old := f.active
	f.active = next
	return old
}

func (f *Facade) drainTransition(ctx context.Context, oldClient gatewayClient, newClient gatewayClient, eventName string) {
	if oldClient == nil {
		return
	}
	var terminate func(string)
	if f.terminateStream != nil {
		terminate = func(streamID string) {
			f.terminateStream(eventName, streamID)
		}
	}
	if err := shared.DrainConnections(ctx, oldClient, newClient, f.drainTimeout, eventName, terminate); err != nil {
		f.connState.markError(err)
	}
}

func (f *Facade) activeEndpoint() (runtimestate.RemoteEndpoint, string, error) {
	if f.store != nil {
		current, err := f.store.Read()
		if err != nil {
			return runtimestate.RemoteEndpoint{}, "", err
		}
		if current.Remote != nil && strings.TrimSpace(current.Remote.URL) != "" {
			return *current.Remote, "json", nil
		}
	}
	return runtimestate.RemoteEndpoint{
		URL:       f.defaults.URL,
		Token:     f.defaults.Token,
		TLSVerify: f.defaults.TLSVerify,
	}, "env", nil
}

func (f *Facade) remoteEndpointFromInput(input facade.RemoteEndpointInput) (runtimestate.RemoteEndpoint, error) {
	rawURL := strings.TrimSpace(input.URL)
	if !validEndpointURL(rawURL) {
		return runtimestate.RemoteEndpoint{}, facade.NewCodedError(facade.CodeInvalidURL, "url must be a valid http or https URL", http.StatusBadRequest)
	}
	token, err := f.resolveToken(input.Token)
	if err != nil {
		return runtimestate.RemoteEndpoint{}, err
	}
	return runtimestate.RemoteEndpoint{
		URL:       rawURL,
		Token:     token,
		TLSVerify: input.TLSVerify,
	}, nil
}

func (f *Facade) endpointForTest(input *facade.RemoteEndpointInput) (runtimestate.RemoteEndpoint, error) {
	if input == nil {
		endpoint, _, err := f.activeEndpoint()
		if err != nil {
			return runtimestate.RemoteEndpoint{}, err
		}
		if !validEndpointURL(endpoint.URL) {
			return runtimestate.RemoteEndpoint{}, facade.NewCodedError(facade.CodeInvalidURL, "url must be a valid http or https URL", http.StatusBadRequest)
		}
		if endpoint.Token == "" {
			return runtimestate.RemoteEndpoint{}, facade.NewCodedError(facade.CodeTokenRequired, "token is required", http.StatusBadRequest)
		}
		return endpoint, nil
	}
	rawURL := strings.TrimSpace(input.URL)
	if !validEndpointURL(rawURL) {
		return runtimestate.RemoteEndpoint{}, facade.NewCodedError(facade.CodeInvalidURL, "url must be a valid http or https URL", http.StatusBadRequest)
	}
	token, err := f.resolveToken(input.Token)
	if err != nil {
		return runtimestate.RemoteEndpoint{}, err
	}
	return runtimestate.RemoteEndpoint{
		URL:       rawURL,
		Token:     token,
		TLSVerify: input.TLSVerify,
	}, nil
}

func (f *Facade) resolveToken(token string) (string, error) {
	if token == tokenUnchangedSentinel {
		current, _, err := f.activeEndpoint()
		if err != nil {
			return "", err
		}
		token = current.Token
	}
	if token == "" {
		return "", facade.NewCodedError(facade.CodeTokenRequired, "token is required", http.StatusBadRequest)
	}
	return token, nil
}

func (f *Facade) configured() bool {
	if f.store != nil && f.store.RemoteIsConfigured() {
		return true
	}
	return strings.TrimSpace(f.defaults.URL) != ""
}

func endpointView(url string, token string, tlsVerify bool, source string) facade.EndpointView {
	return facade.EndpointView{
		URL:             url,
		TokenConfigured: strings.TrimSpace(token) != "",
		TLSVerify:       tlsVerify,
		Source:          source,
	}
}

func validEndpointURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func gatewayDescribeError(err error) *facade.CodedError {
	if err == nil {
		return nil
	}
	message := err.Error()
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "x509:") || strings.Contains(lower, "certificate") || strings.Contains(lower, "tls:"):
		return facade.NewCodedError(facade.CodeTLSVerificationFailed, "gateway TLS verification failed", http.StatusBadGateway)
	case strings.Contains(lower, "unauthorized") || strings.Contains(lower, "forbidden") || strings.Contains(lower, "invalid token") || strings.Contains(lower, "auth"):
		return facade.NewCodedError(facade.CodeGatewayAuthFailed, "gateway authentication failed", http.StatusUnauthorized)
	default:
		return facade.NewCodedError(facade.CodeGatewayUnreachable, "gateway is unreachable", http.StatusBadGateway)
	}
}

func gatewayWebSocketURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "https://") {
		return "wss://" + strings.TrimPrefix(trimmed, "https://")
	}
	if strings.HasPrefix(trimmed, "http://") {
		return "ws://" + strings.TrimPrefix(trimmed, "http://")
	}
	return trimmed
}

var _ facade.RuntimeFacade = (*Facade)(nil)

func init() {
	facade.RegisterRemoteFactory(func(defaults envconf.RuntimeRemoteDefaults, store *runtimestate.Store) facade.RuntimeFacade {
		return New(defaults, store)
	})
}
