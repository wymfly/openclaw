package openclaw

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/openclaw/openclaw/deck-go/backend/internal/config"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/runtime/facade"
)

var (
	deckVersionOnce sync.Once
	deckVersion     string
)

func (m *ManagedRuntime) GetSettings(ctx context.Context) (deckapi.DeckGoSettingsResponse, error) {
	if m == nil || m.store == nil {
		return deckapi.DeckGoSettingsResponse{}, http.ErrServerClosed
	}
	return deckapi.DeckGoSettingsResponse{
		Ok:       true,
		Settings: toDeckSettings(m.store.Get(), m.store.ServiceTokenStatus()),
		Path:     m.store.Path(),
	}, nil
}

func (m *ManagedRuntime) UpdateSettingsFromConfig(ctx context.Context, settings config.Settings) (deckapi.DeckGoSettingsSaveResponse, error) {
	if m == nil || m.store == nil {
		return deckapi.DeckGoSettingsSaveResponse{}, http.ErrServerClosed
	}
	if err := m.store.Update(settings); err != nil {
		return deckapi.DeckGoSettingsSaveResponse{}, err
	}
	current := m.store.Get()
	return deckapi.DeckGoSettingsSaveResponse{
		Ok:       true,
		Settings: toDeckSettings(current, m.store.ServiceTokenStatus()),
	}, nil
}

func (m *ManagedRuntime) UpdateSettings(ctx context.Context, settings deckapi.DeckGoSettings) (deckapi.DeckGoSettingsSaveResponse, error) {
	if m == nil || m.store == nil {
		return deckapi.DeckGoSettingsSaveResponse{}, http.ErrServerClosed
	}
	next := config.Settings{
		Appearance:    settings.Appearance,
		Notifications: settings.Notifications,
		PairedDevices: settings.PairedDevices,
	}
	if err := m.store.Update(next); err != nil {
		return deckapi.DeckGoSettingsSaveResponse{}, err
	}
	current := m.store.Get()
	if m.bus != nil {
		eventPayload, _ := json.Marshal(map[string]any{
			"type": "settings.saved",
			"path": m.store.Path(),
		})
		m.bus.Publish("runtime.status", eventPayload)
	}
	return deckapi.DeckGoSettingsSaveResponse{
		Ok:       true,
		Settings: toDeckSettings(current, m.store.ServiceTokenStatus()),
	}, nil
}

func (m *ManagedRuntime) TestConnection(ctx context.Context, rawURL string, token string) (map[string]any, error) {
	if strings.TrimSpace(rawURL) == "" {
		return map[string]any{"ok": false, "error": "Gateway URL is required"}, nil
	}
	if strings.TrimSpace(token) == "" && m != nil && m.store != nil {
		effective := m.store.Effective()
		if rawURL == config.ManagedGatewayURL(effective.ManagedGateway) {
			token = effective.ManagedGateway.GatewayToken
		}
	}
	if strings.TrimSpace(token) != "" {
		if err := ProbeConnection(ctx, rawURL, token); err != nil {
			return map[string]any{"ok": false, "error": err.Error()}, nil
		}
		return map[string]any{"ok": true}, nil
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "ws" && parsed.Scheme != "wss") {
		return map[string]any{"ok": false, "error": "URL must use ws:// or wss:// protocol"}, nil
	}
	httpURL := "http" + strings.TrimPrefix(rawURL, "ws")
	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(probeCtx, http.MethodGet, httpURL, nil)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}, nil
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}, nil
	}
	_ = res.Body.Close()
	return map[string]any{"ok": true}, nil
}

func (m *ManagedRuntime) TestLegacySettingsConnection(ctx context.Context, rawURL string, token string) (map[string]any, error) {
	if strings.TrimSpace(rawURL) == "" {
		return map[string]any{"ok": false, "error": "Gateway URL is required"}, nil
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "ws" && parsed.Scheme != "wss") {
		return map[string]any{"ok": false, "error": "URL must use ws:// or wss:// protocol"}, nil
	}
	httpURL := "http" + strings.TrimPrefix(rawURL, "ws")
	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(probeCtx, http.MethodGet, httpURL, nil)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}, nil
	}
	if strings.TrimSpace(token) != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return map[string]any{"ok": false, "error": err.Error()}, nil
	}
	_ = res.Body.Close()
	return map[string]any{"ok": true}, nil
}

func (m *ManagedRuntime) GetVersion(ctx context.Context) (map[string]any, error) {
	lastStatus := m.LastStatus()
	if m != nil && m.facade != nil {
		if refreshed, err := m.refreshFacadeStatus(ctx); err == nil {
			lastStatus = refreshed
		}
	}
	status := runtimeVersionStatus(lastStatus)
	return map[string]any{
		"deck":    readDeckVersion(),
		"gateway": status,
		"cli":     status,
	}, nil
}

func (m *ManagedRuntime) GetOnboardingStatus(ctx context.Context) (map[string]any, error) {
	if m == nil || m.store == nil {
		return nil, http.ErrServerClosed
	}
	_, _, ok := m.store.GatewayConnection()
	return map[string]any{"needsOnboarding": !ok}, nil
}

func (m *ManagedRuntime) TestOnboardingConnection(ctx context.Context, rawURL string, token string) (map[string]any, error) {
	if strings.TrimSpace(rawURL) == "" || strings.TrimSpace(token) == "" {
		return map[string]any{"success": false, "error": "url and token are required"}, nil
	}
	probeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	err := ProbeConnection(probeCtx, rawURL, token)
	return map[string]any{"success": err == nil, "error": errStringValue(err)}, nil
}

func (m *ManagedRuntime) SaveOnboardingSettings(ctx context.Context, gatewayURL string, gatewayToken string) (map[string]any, int, error) {
	if m == nil || m.store == nil {
		return nil, http.StatusInternalServerError, http.ErrServerClosed
	}
	rawURL := strings.TrimSpace(gatewayURL)
	rawToken := strings.TrimSpace(gatewayToken)
	if rawURL == "" || rawToken == "" {
		return map[string]any{"error": "gatewayUrl and gatewayToken are required"}, http.StatusBadRequest, nil
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "ws" && parsed.Scheme != "wss") {
		return map[string]any{"error": "gatewayUrl must use ws:// or wss://"}, http.StatusBadRequest, nil
	}
	host := parsed.Hostname()
	port := 0
	if portText := parsed.Port(); portText != "" {
		parsedPort, parseErr := strconv.Atoi(portText)
		if parseErr != nil || parsedPort <= 0 {
			return map[string]any{"error": "invalid gateway port"}, http.StatusBadRequest, nil
		}
		port = parsedPort
	} else if parsed.Scheme == "wss" {
		port = 443
	} else {
		port = 80
	}
	current := m.store.Get()
	current.ManagedGateway.Mode = "managed"
	current.ManagedGateway.BindHost = host
	current.ManagedGateway.BindPort = port
	current.ManagedGateway.GatewayToken = rawToken
	if err := m.store.Update(current); err != nil {
		return nil, http.StatusInternalServerError, err
	}
	return map[string]any{"success": true}, http.StatusOK, nil
}

func toDeckSettings(current config.Settings, tokenStatus config.ServiceTokenStatus) deckapi.DeckGoSettings {
	return deckapi.DeckGoSettings{
		AccessTokenConfigured: tokenStatus.Configured,
		AccessTokenSource:     tokenStatus.Source,
		Appearance:            current.Appearance,
		Notifications:         current.Notifications,
		PairedDevices:         current.PairedDevices,
	}
}

func readDeckVersion() string {
	deckVersionOnce.Do(func() {
		deckVersion = "unknown"
		for _, candidate := range []string{"package.json", filepath.Join("..", "package.json")} {
			raw, err := os.ReadFile(candidate)
			if err != nil {
				continue
			}
			var payload struct {
				Version string `json:"version"`
			}
			if json.Unmarshal(raw, &payload) == nil && payload.Version != "" {
				deckVersion = payload.Version
				return
			}
		}
	})
	return deckVersion
}

func runtimeVersionStatus(status facade.RuntimeStatus) string {
	if status.Status == "running" || status.Status == "degraded" {
		return "connected"
	}
	return "unknown"
}

func mapsClone(src map[string]string) map[string]string {
	if src == nil {
		return nil
	}
	cloned := make(map[string]string, len(src))
	for key, value := range src {
		cloned[key] = value
	}
	return cloned
}

func errStringValue(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
