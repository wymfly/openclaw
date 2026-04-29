package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
)

type stubSettingsProvider struct {
	getPayload     deckapi.DeckGoSettingsResponse
	savePayload    deckapi.DeckGoSettingsSaveResponse
	testPayload    map[string]any
	versionPayload map[string]any
	lastKey        string
}

func (s *stubSettingsProvider) GetSettings(_ context.Context) (deckapi.DeckGoSettingsResponse, error) {
	s.lastKey = "settings:get"
	return s.getPayload, nil
}

func (s *stubSettingsProvider) UpdateSettings(_ context.Context, settings deckapi.DeckGoSettings) (deckapi.DeckGoSettingsSaveResponse, error) {
	s.lastKey = "settings:update:" + settings.ManagedGateway.Mode
	return s.savePayload, nil
}

func (s *stubSettingsProvider) TestConnection(_ context.Context, rawURL string, token string) (map[string]any, error) {
	s.lastKey = "settings:test:" + rawURL + ":" + token
	return s.testPayload, nil
}

func (s *stubSettingsProvider) GetVersion(_ context.Context) (map[string]any, error) {
	s.lastKey = "settings:version"
	return s.versionPayload, nil
}

type stubAlertsProvider struct {
	listPayload   map[string]any
	createPayload map[string]any
	updatePayload map[string]any
	lastKey       string
}

func (s *stubAlertsProvider) ListAlerts(_ context.Context) (map[string]any, error) {
	s.lastKey = "alerts:list"
	return s.listPayload, nil
}

func (s *stubAlertsProvider) CreateAlert(_ context.Context, input AlertCreateInput) (map[string]any, error) {
	s.lastKey = "alerts:create:" + input.Name
	return s.createPayload, nil
}

func (s *stubAlertsProvider) UpdateAlert(_ context.Context, ruleID string, patch AlertPatchInput) (map[string]any, bool, error) {
	s.lastKey = "alerts:update:" + ruleID
	return s.updatePayload, true, nil
}

func (s *stubAlertsProvider) DeleteAlert(_ context.Context, ruleID string) (bool, error) {
	s.lastKey = "alerts:delete:" + ruleID
	return true, nil
}

type stubWebhookProvider struct {
	listPayload       map[string]any
	createPayload     map[string]any
	updatePayload     map[string]any
	deliveriesPayload map[string]any
	testPayload       map[string]any
	lastKey           string
}

func (s *stubWebhookProvider) ListWebhooks(_ context.Context) (map[string]any, error) {
	s.lastKey = "webhooks:list"
	return s.listPayload, nil
}

func (s *stubWebhookProvider) CreateWebhook(_ context.Context, input WebhookCreateInput) (map[string]any, error) {
	s.lastKey = "webhooks:create:" + input.Name
	return s.createPayload, nil
}

func (s *stubWebhookProvider) UpdateWebhook(_ context.Context, webhookID string, patch WebhookPatchInput) (any, bool, error) {
	s.lastKey = "webhooks:update:" + webhookID
	return s.updatePayload, true, nil
}

func (s *stubWebhookProvider) DeleteWebhook(_ context.Context, webhookID string) (bool, error) {
	s.lastKey = "webhooks:delete:" + webhookID
	return true, nil
}

func (s *stubWebhookProvider) ListWebhookDeliveries(_ context.Context, webhookID string) (map[string]any, error) {
	s.lastKey = "webhooks:deliveries:" + webhookID
	return s.deliveriesPayload, nil
}

func (s *stubWebhookProvider) TestWebhook(_ context.Context, webhookID string) (map[string]any, bool, error) {
	s.lastKey = "webhooks:test:" + webhookID
	return s.testPayload, true, nil
}

type stubLogProvider struct {
	tailPayload map[string]any
	lastKey     string
}

func (s *stubLogProvider) TailLogs(_ context.Context, params map[string]any) (any, error) {
	s.lastKey = "logs:tail"
	return s.tailPayload, nil
}

type stubOnboardingProvider struct {
	statusPayload map[string]any
	testPayload   map[string]any
	savePayload   map[string]any
	saveStatus    int
	lastKey       string
}

func (s *stubOnboardingProvider) GetOnboardingStatus(_ context.Context) (map[string]any, error) {
	s.lastKey = "onboarding:status"
	return s.statusPayload, nil
}

func (s *stubOnboardingProvider) TestOnboardingConnection(_ context.Context, rawURL string, token string) (map[string]any, error) {
	s.lastKey = "onboarding:test:" + rawURL + ":" + token
	return s.testPayload, nil
}

func (s *stubOnboardingProvider) SaveOnboardingSettings(_ context.Context, gatewayURL string, gatewayToken string) (map[string]any, int, error) {
	s.lastKey = "onboarding:save:" + gatewayURL + ":" + gatewayToken
	return s.savePayload, s.saveStatus, nil
}

type stubDocsProvider struct {
	listPayload    map[string]any
	docPayload     map[string]any
	extractPayload map[string]any
	extractStatus  int
	lastKey        string
}

func (s *stubDocsProvider) ListDocs(_ context.Context, category string, query string) (map[string]any, error) {
	s.lastKey = "docs:list:" + category + ":" + query
	return s.listPayload, nil
}

func (s *stubDocsProvider) GetDoc(_ context.Context, docID string) (any, bool, error) {
	s.lastKey = "docs:get:" + docID
	return s.docPayload, true, nil
}

func (s *stubDocsProvider) DeleteDoc(_ context.Context, docID string) (bool, error) {
	s.lastKey = "docs:delete:" + docID
	return true, nil
}

func (s *stubDocsProvider) ExtractDocs(_ context.Context, sessionKey string) (map[string]any, int, error) {
	s.lastKey = "docs:extract:" + sessionKey
	return s.extractPayload, s.extractStatus, nil
}

type stubMemoryBrowseProvider struct {
	browsePayload map[string]any
	browseStatus  int
	searchPayload map[string]any
	searchStatus  int
	lastKey       string
}

func (s *stubMemoryBrowseProvider) BrowseMemory(_ context.Context, agentID string, subPath string, readMode bool) (any, int, error) {
	s.lastKey = "memory:browse:" + agentID + ":" + subPath
	return s.browsePayload, s.browseStatus, nil
}

func (s *stubMemoryBrowseProvider) SearchMemory(_ context.Context, query string, agentID string) (any, int, error) {
	s.lastKey = "memory:search:" + query + ":" + agentID
	return s.searchPayload, s.searchStatus, nil
}

type stubEventStreamProvider struct {
	events []events.Event
	gap    bool
}

func (s *stubEventStreamProvider) EventsSince(lastID int64) ([]events.Event, bool) {
	return s.events, s.gap
}

func (s *stubEventStreamProvider) SubscribeStream() (<-chan events.Event, func()) {
	ch := make(chan events.Event, 1)
	return ch, func() { close(ch) }
}

type stubSessionEventProvider struct {
	lastKey string
}

func (s *stubSessionEventProvider) SubscribeSession(_ context.Context, sessionKey string) error {
	s.lastKey = "subscribe:" + sessionKey
	return nil
}

func (s *stubSessionEventProvider) UnsubscribeSession(_ context.Context, sessionKey string) error {
	s.lastKey = "unsubscribe:" + sessionKey
	return nil
}

type stubChatSnapshotProvider struct {
	detail  deckapi.DeckGoSessionDetailResponse
	lastKey string
}

func (s *stubChatSnapshotProvider) GetTimelineWithParams(_ context.Context, sessionKey string, agentID string, limit int) (deckapi.DeckGoSessionDetailResponse, error) {
	s.lastKey = sessionKey + ":" + agentID + ":" + strconv.Itoa(limit)
	return s.detail, nil
}

type stubAssetProvider struct {
	media   AssetResponse
	canvas  AssetResponse
	deck    AssetResponse
	lastKey string
}

func (s *stubAssetProvider) GetMedia(_ context.Context, filePath string, download bool) (AssetResponse, error) {
	s.lastKey = "media:" + filePath
	return s.media, nil
}

func (s *stubAssetProvider) GetCanvasAsset(_ context.Context, subPath string) (AssetResponse, error) {
	s.lastKey = "canvas:" + subPath
	return s.canvas, nil
}

func (s *stubAssetProvider) HandleDeckCanvas(_ context.Context, body map[string]any) (AssetResponse, error) {
	s.lastKey = "deck-canvas:" + body["action"].(string)
	return s.deck, nil
}

type stubChatCompatProvider struct {
	lastKey string
}

func (s *stubChatCompatProvider) RunCompactionAction(_ context.Context, body map[string]any) (any, int, error) {
	s.lastKey = "chat:compaction:" + body["action"].(string)
	return map[string]any{"ok": true}, http.StatusOK, nil
}

func (s *stubChatCompatProvider) SteerSession(_ context.Context, sessionKey string, message string) (any, int, error) {
	s.lastKey = "chat:steer:" + sessionKey + ":" + message
	return map[string]any{"ok": true}, http.StatusOK, nil
}

type stubBudgetProvider struct {
	listPayload     map[string]any
	createPayload   map[string]any
	createStatus    int
	updatePayload   map[string]any
	updateStatus    int
	evaluatePayload map[string]any
	evaluateStatus  int
	lastKey         string
}

func (s *stubBudgetProvider) ListBudgetRules(_ context.Context) (map[string]any, error) {
	s.lastKey = "budget:list"
	return s.listPayload, nil
}

func (s *stubBudgetProvider) CreateBudgetRule(_ context.Context, input BudgetCreateInput) (any, int, error) {
	s.lastKey = "budget:create:" + input.Name
	return s.createPayload, s.createStatus, nil
}

func (s *stubBudgetProvider) UpdateBudgetRule(_ context.Context, ruleID string, patch BudgetPatchInput) (any, bool, int, error) {
	s.lastKey = "budget:update:" + ruleID
	return s.updatePayload, true, s.updateStatus, nil
}

func (s *stubBudgetProvider) DeleteBudgetRule(_ context.Context, ruleID string) (bool, error) {
	s.lastKey = "budget:delete:" + ruleID
	return true, nil
}

func (s *stubBudgetProvider) EvaluateBudgetRules(_ context.Context) (any, int, error) {
	s.lastKey = "budget:evaluate"
	return s.evaluatePayload, s.evaluateStatus, nil
}

type stubUsageProvider struct {
	payload           map[string]any
	sessionsPayload   map[string]any
	logsPayload       map[string]any
	timeseriesPayload map[string]any
	lastKey           string
}

func (s *stubUsageProvider) GetUsageCost(_ context.Context, days int) (any, error) {
	s.lastKey = "usage:cost:" + strconv.Itoa(days)
	return s.payload, nil
}

func (s *stubUsageProvider) GetUsageSessions(_ context.Context, params map[string]any) (any, error) {
	s.lastKey = "usage:sessions"
	return s.sessionsPayload, nil
}

func (s *stubUsageProvider) GetUsageSessionLogs(_ context.Context, params map[string]any) (any, error) {
	s.lastKey = "usage:sessions:logs"
	return s.logsPayload, nil
}

func (s *stubUsageProvider) GetUsageTimeseries(_ context.Context, params map[string]any) (any, error) {
	s.lastKey = "usage:timeseries"
	return s.timeseriesPayload, nil
}

type stubModelAdminProvider struct {
	configPayload map[string]any
	usagePayload  map[string]any
	costPayload   map[string]any
	lastKey       string
}

func (s *stubModelAdminProvider) GetModelsConfig(_ context.Context) (any, error) {
	s.lastKey = "models:config:get"
	return s.configPayload, nil
}

func (s *stubModelAdminProvider) PatchModelsConfig(_ context.Context, raw string, baseHash string, note string) (any, error) {
	s.lastKey = "models:config:patch"
	return map[string]any{"ok": true, "baseHash": baseHash}, nil
}

func (s *stubModelAdminProvider) GetModelUsageProviders(_ context.Context) (any, error) {
	s.lastKey = "models:usage:providers"
	return s.usagePayload, nil
}

func (s *stubModelAdminProvider) GetModelUsageCost(_ context.Context, days int) (any, error) {
	s.lastKey = "models:usage:cost:" + strconv.Itoa(days)
	return s.costPayload, nil
}

func TestMountAdminRoutes(t *testing.T) {
	router := chi.NewRouter()
	settings := &stubSettingsProvider{
		getPayload: deckapi.DeckGoSettingsResponse{
			Ok: true,
			Settings: deckapi.DeckGoSettings{
				ManagedGateway: deckapi.DeckGoManagedGatewaySettings{
					Mode:         "managed",
					BindHost:     "127.0.0.1",
					BindPort:     18789,
					AutoStart:    true,
					GatewayToken: "token-1",
				},
			},
			Path: "/tmp/settings.json",
		},
		savePayload: deckapi.DeckGoSettingsSaveResponse{
			Ok: true,
			Settings: deckapi.DeckGoSettings{
				ManagedGateway: deckapi.DeckGoManagedGatewaySettings{Mode: "managed"},
			},
		},
		testPayload:    map[string]any{"ok": true},
		versionPayload: map[string]any{"deck": "1.0.0", "gateway": "connected", "cli": "connected"},
	}
	alerts := &stubAlertsProvider{
		listPayload:   map[string]any{"rules": []map[string]any{{"id": "rule-1"}}},
		createPayload: map[string]any{"rule": map[string]any{"id": "rule-1"}},
		updatePayload: map[string]any{"rule": map[string]any{"id": "rule-1", "enabled": false}},
	}
	webhooks := &stubWebhookProvider{
		listPayload:       map[string]any{"webhooks": []map[string]any{{"id": "wh-1"}}},
		createPayload:     map[string]any{"id": "wh-1"},
		updatePayload:     map[string]any{"id": "wh-1", "enabled": false},
		deliveriesPayload: map[string]any{"deliveries": []map[string]any{{"id": "wd-1"}}},
		testPayload:       map[string]any{"success": true, "deliveryId": "wd-1"},
	}
	logs := &stubLogProvider{
		tailPayload: map[string]any{"cursor": 42, "lines": []any{"hello"}},
	}
	onboarding := &stubOnboardingProvider{
		statusPayload: map[string]any{"needsOnboarding": false},
		testPayload:   map[string]any{"success": true},
		savePayload:   map[string]any{"success": true},
		saveStatus:    http.StatusOK,
	}
	docs := &stubDocsProvider{
		listPayload:    map[string]any{"docs": []map[string]any{{"id": "doc-1"}}},
		docPayload:     map[string]any{"id": "doc-1"},
		extractPayload: map[string]any{"extracted": 1, "docs": []map[string]any{{"id": "doc-1"}}},
		extractStatus:  http.StatusOK,
	}
	memory := &stubMemoryBrowseProvider{
		browsePayload: map[string]any{"files": []map[string]any{{"name": "note.md"}}},
		browseStatus:  http.StatusOK,
		searchPayload: map[string]any{"error": "Not implemented — requires LanceDB extension"},
		searchStatus:  http.StatusNotImplemented,
	}
	stream := &stubEventStreamProvider{
		events: []events.Event{{ID: 41, Type: "chat", Data: []byte(`{"ok":true}`)}},
		gap:    true,
	}
	sessionEvents := &stubSessionEventProvider{}
	snapshots := &stubChatSnapshotProvider{
		detail: deckapi.DeckGoSessionDetailResponse{
			Session: deckapi.DeckGoSessionMeta{Key: "session-1", AgentId: "main", Status: "running"},
			Messages: []deckapi.DeckGoTranscriptMessage{
				{Id: "msg-1", Role: "assistant", Content: []deckapi.DeckGoTranscriptBlock{{Type: "text", Text: "hi"}}},
			},
			ActiveApproval: map[string]any{"id": "approval-1"},
		},
	}
	assets := &stubAssetProvider{
		media: AssetResponse{
			Status:  http.StatusOK,
			Headers: map[string]string{"Content-Type": "text/plain"},
			Body:    []byte("artifact"),
		},
		canvas: AssetResponse{
			Status:  http.StatusOK,
			Headers: map[string]string{"Content-Type": "text/html; charset=utf-8"},
			Body:    []byte("<html><body>canvas</body></html>"),
		},
		deck: AssetResponse{
			Status: http.StatusOK,
			JSON:   map[string]any{"ok": true},
		},
	}
	chat := &stubChatCompatProvider{}
	budget := &stubBudgetProvider{
		listPayload:     map[string]any{"rules": []map[string]any{{"id": "br-1"}}},
		createPayload:   map[string]any{"id": "br-1"},
		createStatus:    http.StatusCreated,
		updatePayload:   map[string]any{"id": "br-1", "enabled": false},
		updateStatus:    http.StatusOK,
		evaluatePayload: map[string]any{"evaluations": []map[string]any{{"ruleId": "br-1", "status": "warn"}}},
		evaluateStatus:  http.StatusOK,
	}
	usage := &stubUsageProvider{
		payload:           map[string]any{"totals": map[string]any{"totalCost": 12}},
		sessionsPayload:   map[string]any{"items": []map[string]any{{"key": "session-1"}}},
		logsPayload:       map[string]any{"items": []map[string]any{{"key": "session-1"}}},
		timeseriesPayload: map[string]any{"points": []map[string]any{{"ts": "2026-04-01"}}},
	}
	models := &stubModelAdminProvider{
		configPayload: map[string]any{"raw": "{\"models\":{\"providers\":{}}}", "hash": "h1"},
		usagePayload:  map[string]any{"providers": []map[string]any{{"provider": "openai"}}},
		costPayload:   map[string]any{"totals": map[string]any{"totalCost": 12}},
	}
	MountAdminRoutes(router, settings, alerts, webhooks, logs, onboarding, docs, memory, stream, sessionEvents, snapshots, assets, chat, budget, usage, models)

	server := httptest.NewServer(router)
	defer server.Close()

	t.Run("returns settings payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/settings")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload deckapi.DeckGoSettingsResponse
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if !payload.Ok || payload.Settings.ManagedGateway.Mode != "managed" {
			t.Fatalf("unexpected settings payload: %#v", payload)
		}
	})

	t.Run("updates settings payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPut, server.URL+"/settings", strings.NewReader(`{"managedGateway":{"mode":"managed"}}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if settings.lastKey != "settings:update:managed" {
			t.Fatalf("unexpected settings update invocation: %q", settings.lastKey)
		}
	})

	t.Run("tests settings connection", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/settings/test-connection", strings.NewReader(`{"url":"ws://localhost:18789","token":"token-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if settings.lastKey != "settings:test:ws://localhost:18789:token-1" {
			t.Fatalf("unexpected settings test invocation: %q", settings.lastKey)
		}
	})

	t.Run("returns settings version", func(t *testing.T) {
		res, err := http.Get(server.URL + "/settings/version")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["deck"] != "1.0.0" || payload["gateway"] != "connected" {
			t.Fatalf("unexpected settings version payload: %#v", payload)
		}
	})

	t.Run("returns alerts payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/alerts")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["rules"] == nil {
			t.Fatalf("unexpected alerts payload: %#v", payload)
		}
	})

	t.Run("creates alert payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/alerts", strings.NewReader(`{"name":"High Usage","entityType":"usage","condition":">=","threshold":80}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusCreated {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if alerts.lastKey != "alerts:create:High Usage" {
			t.Fatalf("unexpected alerts create invocation: %q", alerts.lastKey)
		}
	})

	t.Run("updates alert payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/alerts/rule-1", strings.NewReader(`{"enabled":false}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if alerts.lastKey != "alerts:update:rule-1" {
			t.Fatalf("unexpected alerts update invocation: %q", alerts.lastKey)
		}
	})

	t.Run("deletes alert payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/alerts/rule-1", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if alerts.lastKey != "alerts:delete:rule-1" {
			t.Fatalf("unexpected alerts delete invocation: %q", alerts.lastKey)
		}
	})

	t.Run("returns webhooks payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/webhooks")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["webhooks"] == nil {
			t.Fatalf("unexpected webhooks payload: %#v", payload)
		}
	})

	t.Run("creates webhook payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/webhooks", strings.NewReader(`{"name":"Audit","url":"https://example.com","events":[]}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusCreated {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if webhooks.lastKey != "webhooks:create:Audit" {
			t.Fatalf("unexpected webhooks create invocation: %q", webhooks.lastKey)
		}
	})

	t.Run("updates webhook payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/webhooks/wh-1", strings.NewReader(`{"enabled":false}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if webhooks.lastKey != "webhooks:update:wh-1" {
			t.Fatalf("unexpected webhooks update invocation: %q", webhooks.lastKey)
		}
	})

	t.Run("deletes webhook payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/webhooks/wh-1", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if webhooks.lastKey != "webhooks:delete:wh-1" {
			t.Fatalf("unexpected webhooks delete invocation: %q", webhooks.lastKey)
		}
	})

	t.Run("returns webhook deliveries payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/webhooks/wh-1/deliveries")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["deliveries"] == nil {
			t.Fatalf("unexpected webhook deliveries payload: %#v", payload)
		}
	})

	t.Run("tests webhook payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/webhooks/wh-1/test", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if webhooks.lastKey != "webhooks:test:wh-1" {
			t.Fatalf("unexpected webhook test invocation: %q", webhooks.lastKey)
		}
	})

	t.Run("returns logs payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/logs?cursor=10&limit=25&maxBytes=5000")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		var payload map[string]any
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["lines"] == nil {
			t.Fatalf("unexpected logs payload: %#v", payload)
		}
	})

	t.Run("streams logs payload", func(t *testing.T) {
		client := http.Client{Timeout: 2 * time.Second}
		req, err := http.NewRequest(http.MethodGet, server.URL+"/logs/stream", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Last-Event-ID", "41")
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		buf := make([]byte, 256)
		n, err := res.Body.Read(buf)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		body := string(buf[:n])
		if !strings.Contains(body, "event: log.batch") {
			t.Fatalf("unexpected log stream body: %q", body)
		}
	})

	t.Run("returns onboarding status payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/onboarding/status")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("tests onboarding connection payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/onboarding/test-connection", strings.NewReader(`{"url":"ws://localhost:18789","token":"token-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("saves onboarding settings payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/onboarding/save-settings", strings.NewReader(`{"gatewayUrl":"ws://localhost:18789","gatewayToken":"token-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("returns docs payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/docs?q=spec")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("returns doc payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/docs/doc-1")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("deletes doc payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/docs/doc-1", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("extracts docs payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/docs/extract", strings.NewReader(`{"sessionKey":"session-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("browses memory payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/memory/browse?agentId=main")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("returns memory search payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/memory/search?q=test")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusNotImplemented {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("streams event payload", func(t *testing.T) {
		client := http.Client{Timeout: 2 * time.Second}
		req, err := http.NewRequest(http.MethodGet, server.URL+"/stream", nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Last-Event-ID", "40")
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		buf := make([]byte, 256)
		var streamBody strings.Builder
		for i := 0; i < 4; i++ {
			n, err := res.Body.Read(buf)
			if err != nil && err != io.EOF {
				t.Fatal(err)
			}
			if n > 0 {
				streamBody.Write(buf[:n])
			}
			body := streamBody.String()
			if strings.Contains(body, "event: projection.gap") && strings.Contains(body, "event: chat") {
				return
			}
			if err == io.EOF {
				break
			}
		}
		body := streamBody.String()
		if !strings.Contains(body, "event: projection.gap") || !strings.Contains(body, "event: chat") {
			t.Fatalf("unexpected stream body: %q", body)
		}
	})

	t.Run("subscribes session events payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/chat/session-events", strings.NewReader(`{"action":"subscribe","sessionKey":"session-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if sessionEvents.lastKey != "subscribe:session-1" {
			t.Fatalf("unexpected session subscribe invocation: %q", sessionEvents.lastKey)
		}
	})

	t.Run("accepts chat projection payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/chat/projection", strings.NewReader(`{"sessionKey":"session-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("returns media payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/media?path=/tmp/file.txt")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if assets.lastKey != "media:/tmp/file.txt" {
			t.Fatalf("unexpected media invocation: %q", assets.lastKey)
		}
	})

	t.Run("returns canvas payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/canvas/index.html")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if assets.lastKey != "canvas:index.html" {
			t.Fatalf("unexpected canvas invocation: %q", assets.lastKey)
		}
	})

	t.Run("accepts deck canvas payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/deck/canvas", strings.NewReader(`{"action":"ready","sessionKey":"session-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if assets.lastKey != "deck-canvas:ready" {
			t.Fatalf("unexpected deck canvas invocation: %q", assets.lastKey)
		}
	})

	t.Run("accepts chat compaction payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/chat/compaction", strings.NewReader(`{"action":"list","key":"session-1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if chat.lastKey != "chat:compaction:list" {
			t.Fatalf("unexpected chat compaction invocation: %q", chat.lastKey)
		}
	})

	t.Run("accepts chat steer payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/chat/steer", strings.NewReader(`{"sessionKey":"session-1","message":"please continue"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if chat.lastKey != "chat:steer:session-1:please continue" {
			t.Fatalf("unexpected chat steer invocation: %q", chat.lastKey)
		}
	})

	t.Run("returns budget rules payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/usage/budget")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
	})

	t.Run("creates budget rule payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPost, server.URL+"/usage/budget", strings.NewReader(`{"name":"Budget","dimension":"cost"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusCreated {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if budget.lastKey != "budget:create:Budget" {
			t.Fatalf("unexpected budget create invocation: %q", budget.lastKey)
		}
	})

	t.Run("updates budget rule payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/usage/budget/br-1", strings.NewReader(`{"enabled":false}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if budget.lastKey != "budget:update:br-1" {
			t.Fatalf("unexpected budget update invocation: %q", budget.lastKey)
		}
	})

	t.Run("deletes budget rule payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodDelete, server.URL+"/usage/budget/br-1", nil)
		if err != nil {
			t.Fatal(err)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if budget.lastKey != "budget:delete:br-1" {
			t.Fatalf("unexpected budget delete invocation: %q", budget.lastKey)
		}
	})

	t.Run("evaluates budget rules payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/usage/budget/evaluate")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if budget.lastKey != "budget:evaluate" {
			t.Fatalf("unexpected budget evaluate invocation: %q", budget.lastKey)
		}
	})

	t.Run("returns chat snapshot payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/chat/snapshot?sessionKey=session-1&agentId=main&limit=25")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if snapshots.lastKey != "session-1:main:25" {
			t.Fatalf("unexpected chat snapshot invocation: %q", snapshots.lastKey)
		}
		var payload struct {
			Messages []map[string]any `json:"messages"`
			Meta     map[string]any   `json:"meta"`
		}
		if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Messages) != 1 {
			t.Fatalf("unexpected messages payload: %#v", payload)
		}
		if payload.Meta["key"] != "session-1" {
			t.Fatalf("unexpected meta payload: %#v", payload)
		}
	})

	t.Run("returns usage cost payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/usage/cost?days=7")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if usage.lastKey != "usage:cost:7" {
			t.Fatalf("unexpected usage cost invocation: %q", usage.lastKey)
		}
	})

	t.Run("returns usage sessions payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/usage/sessions?startDate=2026-04-01&endDate=2026-04-06&limit=20")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if usage.lastKey != "usage:sessions" {
			t.Fatalf("unexpected usage sessions invocation: %q", usage.lastKey)
		}
	})

	t.Run("returns usage session logs payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/usage/sessions/logs?key=session-1&limit=50")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if usage.lastKey != "usage:sessions:logs" {
			t.Fatalf("unexpected usage session logs invocation: %q", usage.lastKey)
		}
	})

	t.Run("returns usage timeseries payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/usage/timeseries?key=session-1&startDate=2026-04-01&endDate=2026-04-07")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if usage.lastKey != "usage:timeseries" {
			t.Fatalf("unexpected usage timeseries invocation: %q", usage.lastKey)
		}
	})

	t.Run("returns models config payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/models/config")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if models.lastKey != "models:config:get" {
			t.Fatalf("unexpected models config invocation: %q", models.lastKey)
		}
	})

	t.Run("patches models config payload", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodPatch, server.URL+"/models/config", strings.NewReader(`{"raw":"{}","baseHash":"h1"}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if models.lastKey != "models:config:patch" {
			t.Fatalf("unexpected models config patch invocation: %q", models.lastKey)
		}
	})

	t.Run("returns model usage providers payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/models/usage/providers")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if models.lastKey != "models:usage:providers" {
			t.Fatalf("unexpected model usage providers invocation: %q", models.lastKey)
		}
	})

	t.Run("returns model usage cost payload", func(t *testing.T) {
		res, err := http.Get(server.URL + "/models/usage/cost?days=14")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("unexpected status: %d", res.StatusCode)
		}
		if models.lastKey != "models:usage:cost:14" {
			t.Fatalf("unexpected model usage cost invocation: %q", models.lastKey)
		}
	})
}
