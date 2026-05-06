package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/deckapi"
	"github.com/openclaw/openclaw/deck-go/backend/internal/events"
	openclawrt "github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw"
)

type SettingsProvider interface {
	GetSettings(ctx context.Context) (deckapi.DeckGoSettingsResponse, error)
	UpdateSettings(ctx context.Context, settings deckapi.DeckGoSettings) (deckapi.DeckGoSettingsSaveResponse, error)
	TestConnection(ctx context.Context, rawURL string, token string) (map[string]any, error)
	GetVersion(ctx context.Context) (map[string]any, error)
}

type AlertCreateInput struct {
	Name       string   `json:"name"`
	EntityType string   `json:"entityType"`
	Condition  string   `json:"condition"`
	Threshold  *float64 `json:"threshold"`
	Action     string   `json:"action"`
	CooldownMs *float64 `json:"cooldownMs"`
	Enabled    *bool    `json:"enabled"`
}

type AlertPatchInput struct {
	Name       *string  `json:"name"`
	EntityType *string  `json:"entityType"`
	Condition  *string  `json:"condition"`
	Threshold  *float64 `json:"threshold"`
	Action     *string  `json:"action"`
	CooldownMs *float64 `json:"cooldownMs"`
	Enabled    *bool    `json:"enabled"`
}

type AlertProvider interface {
	ListAlerts(ctx context.Context) (map[string]any, error)
	CreateAlert(ctx context.Context, input AlertCreateInput) (map[string]any, error)
	UpdateAlert(ctx context.Context, ruleID string, patch AlertPatchInput) (map[string]any, bool, error)
	DeleteAlert(ctx context.Context, ruleID string) (bool, error)
}

func isAlertAction(action string) bool {
	return action == "toast" || action == "activity" || action == "webhook"
}

type WebhookCreateInput struct {
	Name    string   `json:"name"`
	URL     string   `json:"url"`
	Secret  *string  `json:"secret"`
	Events  []string `json:"events"`
	Enabled *bool    `json:"enabled"`
}

type WebhookPatchInput struct {
	Name    *string   `json:"name"`
	URL     *string   `json:"url"`
	Secret  **string  `json:"secret"`
	Events  *[]string `json:"events"`
	Enabled *bool     `json:"enabled"`
}

type WebhookProvider interface {
	ListWebhooks(ctx context.Context) (map[string]any, error)
	CreateWebhook(ctx context.Context, input WebhookCreateInput) (map[string]any, error)
	UpdateWebhook(ctx context.Context, webhookID string, patch WebhookPatchInput) (any, bool, error)
	DeleteWebhook(ctx context.Context, webhookID string) (bool, error)
	ListWebhookDeliveries(ctx context.Context, webhookID string) (map[string]any, error)
	TestWebhook(ctx context.Context, webhookID string) (map[string]any, bool, error)
}

type LogProvider interface {
	TailLogs(ctx context.Context, params map[string]any) (any, error)
}

type OnboardingProvider interface {
	GetOnboardingStatus(ctx context.Context) (map[string]any, error)
	TestOnboardingConnection(ctx context.Context, rawURL string, token string) (map[string]any, error)
	SaveOnboardingSettings(ctx context.Context, gatewayURL string, gatewayToken string) (map[string]any, int, error)
}

type DocsProvider interface {
	ListDocs(ctx context.Context, category string, query string) (map[string]any, error)
	GetDoc(ctx context.Context, docID string) (any, bool, error)
	DeleteDoc(ctx context.Context, docID string) (bool, error)
	ExtractDocs(ctx context.Context, sessionKey string) (map[string]any, int, error)
}

type MemoryBrowseProvider interface {
	BrowseMemory(ctx context.Context, agentID string, subPath string, readMode bool) (any, int, error)
	SearchMemory(ctx context.Context, query string, agentID string, scope string) (any, int, error)
}

type EventStreamProvider interface {
	EventsSince(lastID int64) ([]events.Event, bool)
	SubscribeStream() (<-chan events.Event, func())
}

type SessionEventProvider interface {
	SubscribeSession(ctx context.Context, sessionKey string) error
	UnsubscribeSession(ctx context.Context, sessionKey string) error
}

type ChatSnapshotProvider interface {
	GetTimelineWithParams(ctx context.Context, sessionKey string, agentID string, limit int) (deckapi.DeckGoSessionDetailResponse, error)
}

type AssetResponse = openclawrt.AssetResponse

type AssetProvider interface {
	GetMedia(ctx context.Context, filePath string, download bool) (AssetResponse, error)
	GetCanvasAsset(ctx context.Context, subPath string) (AssetResponse, error)
	HandleDeckCanvas(ctx context.Context, body map[string]any) (AssetResponse, error)
}

type ChatCompatProvider interface {
	RunCompactionAction(ctx context.Context, body map[string]any) (any, int, error)
	SteerSession(ctx context.Context, sessionKey string, message string) (any, int, error)
}

type BudgetCreateInput = openclawrt.BudgetCreateInput

type BudgetPatchInput = openclawrt.BudgetPatchInput

type BudgetProvider interface {
	ListBudgetRules(ctx context.Context) (map[string]any, error)
	CreateBudgetRule(ctx context.Context, input BudgetCreateInput) (any, int, error)
	UpdateBudgetRule(ctx context.Context, ruleID string, patch BudgetPatchInput) (any, bool, int, error)
	DeleteBudgetRule(ctx context.Context, ruleID string) (bool, error)
	EvaluateBudgetRules(ctx context.Context) (any, int, error)
}

type UsageProvider interface {
	GetUsageCost(ctx context.Context, days int) (any, error)
	GetUsageProviders(ctx context.Context) (any, error)
	GetUsageSessions(ctx context.Context, params map[string]any) (any, error)
	GetUsageSessionLogs(ctx context.Context, params map[string]any) (any, error)
	GetUsageTimeseries(ctx context.Context, params map[string]any) (any, error)
}

type ModelAdminProvider interface {
	GetModelsConfig(ctx context.Context) (any, error)
	PatchModelsConfig(ctx context.Context, raw string, baseHash string, note string) (any, error)
	GetModelUsageProviders(ctx context.Context) (any, error)
	GetModelUsageCost(ctx context.Context, days int) (any, error)
}

const (
	adminLogPollInterval         = 1 * time.Second
	adminStreamHeartbeatInterval = 15 * time.Second
)

func MountAdminRoutes(r chi.Router, settings SettingsProvider, alerts AlertProvider, webhooks WebhookProvider, logs LogProvider, onboarding OnboardingProvider, docs DocsProvider, memory MemoryBrowseProvider, stream EventStreamProvider, sessionEvents SessionEventProvider, snapshots ChatSnapshotProvider, assets AssetProvider, chat ChatCompatProvider, budget BudgetProvider, usage UsageProvider, models ModelAdminProvider) {
	if settings != nil {
		r.Get("/settings", func(w http.ResponseWriter, req *http.Request) {
			payload, err := settings.GetSettings(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Put("/settings", func(w http.ResponseWriter, req *http.Request) {
			var body deckapi.DeckGoSettings
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
				return
			}
			payload, err := settings.UpdateSettings(req.Context(), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/settings/test-connection", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				URL   string `json:"url"`
				Token string `json:"token"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
				return
			}
			payload, err := settings.TestConnection(req.Context(), body.URL, body.Token)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/settings/version", func(w http.ResponseWriter, req *http.Request) {
			payload, err := settings.GetVersion(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if alerts != nil {
		r.Get("/alerts", func(w http.ResponseWriter, req *http.Request) {
			payload, err := alerts.ListAlerts(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/alerts", func(w http.ResponseWriter, req *http.Request) {
			var body AlertCreateInput
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			if body.Name == "" || body.EntityType == "" || body.Condition == "" || body.Threshold == nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Missing required fields: name, entityType, condition, threshold"})
				return
			}
			if body.Action != "" && !isAlertAction(body.Action) {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid alert action"})
				return
			}
			payload, err := alerts.CreateAlert(req.Context(), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, payload)
		})

		r.Patch("/alerts/{ruleId}", func(w http.ResponseWriter, req *http.Request) {
			var body AlertPatchInput
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			if body.Name == nil && body.EntityType == nil && body.Condition == nil && body.Threshold == nil && body.Action == nil && body.CooldownMs == nil && body.Enabled == nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "No fields to update"})
				return
			}
			if body.Action != nil && !isAlertAction(*body.Action) {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid alert action"})
				return
			}
			payload, found, err := alerts.UpdateAlert(req.Context(), chi.URLParam(req, "ruleId"), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !found {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Delete("/alerts/{ruleId}", func(w http.ResponseWriter, req *http.Request) {
			deleted, err := alerts.DeleteAlert(req.Context(), chi.URLParam(req, "ruleId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !deleted {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		})
	}

	if webhooks != nil {
		r.Get("/webhooks", func(w http.ResponseWriter, req *http.Request) {
			payload, err := webhooks.ListWebhooks(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/webhooks", func(w http.ResponseWriter, req *http.Request) {
			var body WebhookCreateInput
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			if body.Name == "" || body.URL == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "name and url are required"})
				return
			}
			if _, err := url.Parse(body.URL); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid URL"})
				return
			}
			payload, err := webhooks.CreateWebhook(req.Context(), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusCreated, payload)
		})

		r.Patch("/webhooks/{webhookId}", func(w http.ResponseWriter, req *http.Request) {
			var body WebhookPatchInput
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			if body.Name == nil && body.URL == nil && body.Secret == nil && body.Events == nil && body.Enabled == nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "No fields to update"})
				return
			}
			if body.URL != nil {
				if _, err := url.Parse(*body.URL); err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid URL"})
					return
				}
			}
			payload, found, err := webhooks.UpdateWebhook(req.Context(), chi.URLParam(req, "webhookId"), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !found {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Webhook not found"})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Delete("/webhooks/{webhookId}", func(w http.ResponseWriter, req *http.Request) {
			deleted, err := webhooks.DeleteWebhook(req.Context(), chi.URLParam(req, "webhookId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !deleted {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Webhook not found"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		})

		r.Get("/webhooks/{webhookId}/deliveries", func(w http.ResponseWriter, req *http.Request) {
			payload, err := webhooks.ListWebhookDeliveries(req.Context(), chi.URLParam(req, "webhookId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/webhooks/{webhookId}/test", func(w http.ResponseWriter, req *http.Request) {
			payload, found, err := webhooks.TestWebhook(req.Context(), chi.URLParam(req, "webhookId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !found {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Webhook not found"})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if logs != nil {
		r.Get("/logs", func(w http.ResponseWriter, req *http.Request) {
			params := map[string]any{}
			if cursorRaw := req.URL.Query().Get("cursor"); cursorRaw != "" {
				cursor, err := strconv.Atoi(cursorRaw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid cursor"})
					return
				}
				params["cursor"] = cursor
			}
			if limitRaw := req.URL.Query().Get("limit"); limitRaw != "" {
				limit, err := strconv.Atoi(limitRaw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid limit"})
					return
				}
				params["limit"] = limit
			}
			if maxBytesRaw := req.URL.Query().Get("maxBytes"); maxBytesRaw != "" {
				maxBytes, err := strconv.Atoi(maxBytesRaw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid maxBytes"})
					return
				}
				params["maxBytes"] = maxBytes
			}
			payload, err := logs.TailLogs(req.Context(), params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "method": "logs.tail", "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/logs/stream", func(w http.ResponseWriter, req *http.Request) {
			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "streaming unsupported", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache, no-transform")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("X-Accel-Buffering", "no")

			lastEventID := req.Header.Get("Last-Event-ID")
			var cursor int
			if lastEventID != "" {
				if parsed, err := strconv.Atoi(lastEventID); err == nil {
					cursor = parsed
				}
			}

			ctx := req.Context()
			poll := func() error {
				pollCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
				defer cancel()
				params := map[string]any{"limit": 500, "maxBytes": 65536}
				if cursor > 0 {
					params["cursor"] = cursor
				}
				payload, err := logs.TailLogs(pollCtx, params)
				if err != nil {
					return err
				}
				record, ok := payload.(map[string]any)
				if !ok {
					return nil
				}
				if reset, _ := record["reset"].(bool); reset {
					cursor = 0
					_, _ = fmt.Fprint(w, "event: log.reset\ndata: {}\n\n")
					flusher.Flush()
				}
				if nextCursor, ok := record["cursor"].(float64); ok {
					cursor = int(nextCursor)
				}
				lines, _ := record["lines"].([]any)
				if len(lines) > 0 {
					raw, _ := json.Marshal(map[string]any{
						"lines":  lines,
						"cursor": cursor,
					})
					_, _ = fmt.Fprintf(w, "id: %d\nevent: log.batch\ndata: %s\n\n", cursor, raw)
					flusher.Flush()
				}
				return nil
			}

			_ = poll()
			pollTicker := time.NewTicker(adminLogPollInterval)
			heartbeatTicker := time.NewTicker(adminStreamHeartbeatInterval)
			defer pollTicker.Stop()
			defer heartbeatTicker.Stop()

			for {
				select {
				case <-ctx.Done():
					return
				case <-pollTicker.C:
					_ = poll()
				case <-heartbeatTicker.C:
					_, _ = fmt.Fprint(w, ": heartbeat\n\n")
					flusher.Flush()
				}
			}
		})
	}

	if onboarding != nil {
		r.Get("/onboarding/status", func(w http.ResponseWriter, req *http.Request) {
			payload, err := onboarding.GetOnboardingStatus(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/onboarding/test-connection", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				URL   string `json:"url"`
				Token string `json:"token"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "invalid json body"})
				return
			}
			payload, err := onboarding.TestOnboardingConnection(req.Context(), body.URL, body.Token)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/onboarding/save-settings", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				GatewayURL   string `json:"gatewayUrl"`
				GatewayToken string `json:"gatewayToken"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			payload, status, err := onboarding.SaveOnboardingSettings(req.Context(), body.GatewayURL, body.GatewayToken)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})
	}

	if docs != nil {
		r.Get("/docs", func(w http.ResponseWriter, req *http.Request) {
			payload, err := docs.ListDocs(req.Context(), req.URL.Query().Get("category"), req.URL.Query().Get("q"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/docs/{docId}", func(w http.ResponseWriter, req *http.Request) {
			payload, found, err := docs.GetDoc(req.Context(), chi.URLParam(req, "docId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !found {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Document not found"})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Delete("/docs/{docId}", func(w http.ResponseWriter, req *http.Request) {
			deleted, err := docs.DeleteDoc(req.Context(), chi.URLParam(req, "docId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !deleted {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Document not found"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		})

		r.Post("/docs/extract", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				SessionKey string `json:"sessionKey"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			payload, status, err := docs.ExtractDocs(req.Context(), body.SessionKey)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})
	}

	if memory != nil {
		r.Get("/memory/browse", func(w http.ResponseWriter, req *http.Request) {
			payload, status, err := memory.BrowseMemory(
				req.Context(),
				req.URL.Query().Get("agentId"),
				req.URL.Query().Get("path"),
				req.URL.Query().Get("read") == "1",
			)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})

		handleMemorySearch := func(w http.ResponseWriter, req *http.Request, query string, agentID string, scope string) {
			payload, status, err := memory.SearchMemory(
				req.Context(),
				query,
				agentID,
				scope,
			)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		}

		r.Get("/memory/search", func(w http.ResponseWriter, req *http.Request) {
			handleMemorySearch(
				w,
				req,
				req.URL.Query().Get("q"),
				req.URL.Query().Get("agentId"),
				req.URL.Query().Get("scope"),
			)
		})

		r.Post("/memory/search", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				Query   string `json:"query"`
				AgentID string `json:"agentId"`
				Scope   string `json:"scope"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			handleMemorySearch(w, req, body.Query, body.AgentID, body.Scope)
		})
	}

	if stream != nil {
		r.Get("/stream", func(w http.ResponseWriter, req *http.Request) {
			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "streaming unsupported", http.StatusInternalServerError)
				return
			}
			lastEventID, _ := strconv.ParseInt(req.Header.Get("Last-Event-ID"), 10, 64)
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache, no-transform")
			w.Header().Set("Connection", "keep-alive")
			w.Header().Set("X-Accel-Buffering", "no")

			for _, event := range func() []events.Event {
				items, gap := stream.EventsSince(lastEventID)
				if gap {
					_, _ = fmt.Fprintf(w, "event: projection.gap\ndata: {\"reason\":\"events_pruned\"}\n\n")
					flusher.Flush()
				}
				return items
			}() {
				_, _ = fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", event.ID, event.Type, event.Data)
				flusher.Flush()
			}

			sub, unsubscribe := stream.SubscribeStream()
			defer unsubscribe()
			ticker := time.NewTicker(adminStreamHeartbeatInterval)
			defer ticker.Stop()
			ctx := req.Context()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					_, _ = fmt.Fprint(w, ": heartbeat\n\n")
					flusher.Flush()
				case event := <-sub:
					_, _ = fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", event.ID, event.Type, event.Data)
					flusher.Flush()
				}
			}
		})
	}

	if sessionEvents != nil {
		r.Post("/chat/session-events", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				Action     string `json:"action"`
				SessionKey string `json:"sessionKey"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid json body"})
				return
			}
			if strings.TrimSpace(body.SessionKey) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "sessionKey is required"})
				return
			}
			switch body.Action {
			case "subscribe":
				if err := sessionEvents.SubscribeSession(req.Context(), body.SessionKey); err != nil {
					writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
					return
				}
			case "unsubscribe":
				if err := sessionEvents.UnsubscribeSession(req.Context(), body.SessionKey); err != nil {
					writeJSON(w, http.StatusBadGateway, map[string]any{"ok": false, "error": err.Error()})
					return
				}
			default:
				writeJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "action must be subscribe or unsubscribe"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true, "sessionKey": body.SessionKey, "action": body.Action})
		})

		r.Post("/chat/projection", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				SessionKey string `json:"sessionKey"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			if strings.TrimSpace(body.SessionKey) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "sessionKey is required"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		})
	}

	if snapshots != nil {
		r.Get("/chat/snapshot", func(w http.ResponseWriter, req *http.Request) {
			sessionKey := req.URL.Query().Get("sessionKey")
			if strings.TrimSpace(sessionKey) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "sessionKey is required"})
				return
			}
			agentID := req.URL.Query().Get("agentId")
			limit := 0
			if raw := req.URL.Query().Get("limit"); raw != "" {
				parsed, err := strconv.Atoi(raw)
				if err != nil || parsed <= 0 {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid limit"})
					return
				}
				limit = parsed
			}
			detail, err := snapshots.GetTimelineWithParams(req.Context(), sessionKey, agentID, limit)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{
				"messages":       detail.Messages,
				"meta":           detail.Session,
				"activeApproval": detail.ActiveApproval,
				"a2uiState":      detail.A2uiState,
			})
		})
	}

	if assets != nil {
		r.Get("/media", func(w http.ResponseWriter, req *http.Request) {
			filePath := req.URL.Query().Get("path")
			if filePath == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "path is required"})
				return
			}
			result, err := assets.GetMedia(req.Context(), filePath, req.URL.Query().Get("dl") == "1")
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeAssetResponse(w, result)
		})

		r.Get("/canvas/*", func(w http.ResponseWriter, req *http.Request) {
			subPath := chi.URLParam(req, "*")
			result, err := assets.GetCanvasAsset(req.Context(), subPath)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeAssetResponse(w, result)
		})

		r.Post("/deck/canvas", func(w http.ResponseWriter, req *http.Request) {
			var body map[string]any
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid body"})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			result, err := assets.HandleDeckCanvas(req.Context(), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeAssetResponse(w, result)
		})
	}

	if chat != nil {
		r.Post("/chat/compaction", func(w http.ResponseWriter, req *http.Request) {
			var body map[string]any
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			if body == nil {
				body = map[string]any{}
			}
			payload, status, err := chat.RunCompactionAction(req.Context(), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})

		r.Post("/chat/steer", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				SessionKey string `json:"sessionKey"`
				Message    string `json:"message"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			payload, status, err := chat.SteerSession(req.Context(), body.SessionKey, body.Message)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})
	}

	if budget != nil {
		r.Get("/usage/budget", func(w http.ResponseWriter, req *http.Request) {
			payload, err := budget.ListBudgetRules(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Post("/usage/budget", func(w http.ResponseWriter, req *http.Request) {
			var body BudgetCreateInput
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			payload, status, err := budget.CreateBudgetRule(req.Context(), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})

		r.Patch("/usage/budget/{ruleId}", func(w http.ResponseWriter, req *http.Request) {
			var body BudgetPatchInput
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
				return
			}
			payload, found, status, err := budget.UpdateBudgetRule(req.Context(), chi.URLParam(req, "ruleId"), body)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !found {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
				return
			}
			writeJSON(w, status, payload)
		})

		r.Delete("/usage/budget/{ruleId}", func(w http.ResponseWriter, req *http.Request) {
			deleted, err := budget.DeleteBudgetRule(req.Context(), chi.URLParam(req, "ruleId"))
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			if !deleted {
				writeJSON(w, http.StatusNotFound, map[string]any{"error": "Rule not found"})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
		})

		r.Get("/usage/budget/evaluate", func(w http.ResponseWriter, req *http.Request) {
			payload, status, err := budget.EvaluateBudgetRules(req.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, status, payload)
		})
	}

	if usage != nil {
		r.Get("/usage/cost", func(w http.ResponseWriter, req *http.Request) {
			days := 1
			if raw := req.URL.Query().Get("days"); raw != "" {
				parsed, err := strconv.Atoi(raw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid days"})
					return
				}
				days = parsed
			}
			payload, err := usage.GetUsageCost(req.Context(), days)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/usage/providers", func(w http.ResponseWriter, req *http.Request) {
			payload, err := usage.GetUsageProviders(req.Context())
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/usage/sessions", func(w http.ResponseWriter, req *http.Request) {
			params := map[string]any{}
			for _, key := range []string{"startDate", "endDate", "key"} {
				if value := req.URL.Query().Get(key); value != "" {
					params[key] = value
				}
			}
			if req.URL.Query().Get("includeContextWeight") == "true" {
				params["includeContextWeight"] = true
			}
			if raw := req.URL.Query().Get("limit"); raw != "" {
				parsed, err := strconv.Atoi(raw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid limit"})
					return
				}
				params["limit"] = parsed
			}
			payload, err := usage.GetUsageSessions(req.Context(), params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/usage/sessions/logs", func(w http.ResponseWriter, req *http.Request) {
			params := map[string]any{"key": req.URL.Query().Get("key")}
			if raw := req.URL.Query().Get("limit"); raw != "" {
				parsed, err := strconv.Atoi(raw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid limit"})
					return
				}
				params["limit"] = parsed
			}
			payload, err := usage.GetUsageSessionLogs(req.Context(), params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/usage/timeseries", func(w http.ResponseWriter, req *http.Request) {
			params := map[string]any{}
			for _, key := range []string{"key", "startDate", "endDate", "mode", "utcOffset"} {
				if value := req.URL.Query().Get(key); value != "" {
					params[key] = value
				}
			}
			payload, err := usage.GetUsageTimeseries(req.Context(), params)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}

	if models != nil {
		r.Get("/models/config", func(w http.ResponseWriter, req *http.Request) {
			payload, err := models.GetModelsConfig(req.Context())
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Patch("/models/config", func(w http.ResponseWriter, req *http.Request) {
			var body struct {
				Raw      string `json:"raw"`
				BaseHash string `json:"baseHash"`
				Note     string `json:"note"`
			}
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid body"})
				return
			}
			if strings.TrimSpace(body.Raw) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "raw config content is required"})
				return
			}
			payload, err := models.PatchModelsConfig(req.Context(), body.Raw, body.BaseHash, body.Note)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/models/usage/providers", func(w http.ResponseWriter, req *http.Request) {
			payload, err := models.GetModelUsageProviders(req.Context())
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})

		r.Get("/models/usage/cost", func(w http.ResponseWriter, req *http.Request) {
			days := 7
			if raw := req.URL.Query().Get("days"); raw != "" {
				parsed, err := strconv.Atoi(raw)
				if err != nil {
					writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid days"})
					return
				}
				days = parsed
			}
			payload, err := models.GetModelUsageCost(req.Context(), days)
			if err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, payload)
		})
	}
}

func writeAssetResponse(w http.ResponseWriter, result AssetResponse) {
	if result.JSON != nil {
		writeJSON(w, result.Status, result.JSON)
		return
	}
	for key, value := range result.Headers {
		w.Header().Set(key, value)
	}
	w.WriteHeader(result.Status)
	if len(result.Body) > 0 {
		_, _ = w.Write(result.Body)
	}
}
