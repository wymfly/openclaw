package server

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
)

func registerWebhookRoutes(mux interface{ MethodFunc(string, string, http.HandlerFunc) }) {
	mux.MethodFunc("GET", "/webhooks", func(w http.ResponseWriter, _ *http.Request) {
		webhooks := localstore.GetWebhookStore().All()
		sort.Slice(webhooks, func(i, j int) bool {
			return webhooks[i].CreatedAt > webhooks[j].CreatedAt
		})
		writeJSON(w, http.StatusOK, map[string]any{"webhooks": webhooks})
	})

	mux.MethodFunc("POST", "/webhooks", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Name    string   `json:"name"`
			URL     string   `json:"url"`
			Secret  *string  `json:"secret"`
			Events  []string `json:"events"`
			Enabled *bool    `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
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
		now := time.Now().UTC().Format(time.RFC3339)
		enabled := true
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		webhook := localstore.Webhook{
			ID:                  "wh-" + randomID(6),
			Name:                body.Name,
			URL:                 body.URL,
			Secret:              body.Secret,
			Events:              body.Events,
			Enabled:             enabled,
			ConsecutiveFailures: 0,
			LastFiredAt:         nil,
			LastStatus:          nil,
			CreatedAt:           now,
			UpdatedAt:           now,
		}
		localstore.GetWebhookStore().Append(webhook)
		writeJSON(w, http.StatusCreated, webhook)
	})

	mux.MethodFunc("PATCH", "/webhooks/{webhookId}", func(w http.ResponseWriter, r *http.Request) {
		webhookID := chi.URLParam(r, "webhookId")
		store := localstore.GetWebhookStore()
		if _, ok := store.Find(func(item localstore.Webhook) bool { return item.ID == webhookID }); !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Webhook not found"})
			return
		}
		var body struct {
			Name    *string   `json:"name"`
			URL     *string   `json:"url"`
			Secret  **string  `json:"secret"`
			Events  *[]string `json:"events"`
			Enabled *bool     `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
			return
		}
		if body.URL != nil {
			if _, err := url.Parse(*body.URL); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid URL"})
				return
			}
		}
		hasUpdate := body.Name != nil || body.URL != nil || body.Secret != nil || body.Events != nil || body.Enabled != nil
		if !hasUpdate {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "No fields to update"})
			return
		}
		store.UpdateItem(func(item localstore.Webhook) bool { return item.ID == webhookID }, func(item localstore.Webhook) localstore.Webhook {
			item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			if body.Name != nil {
				item.Name = *body.Name
			}
			if body.URL != nil {
				item.URL = *body.URL
			}
			if body.Secret != nil {
				item.Secret = *body.Secret
			}
			if body.Events != nil {
				item.Events = *body.Events
			}
			if body.Enabled != nil {
				item.Enabled = *body.Enabled
			}
			return item
		})
		updated, _ := store.Find(func(item localstore.Webhook) bool { return item.ID == webhookID })
		writeJSON(w, http.StatusOK, updated)
	})

	mux.MethodFunc("DELETE", "/webhooks/{webhookId}", func(w http.ResponseWriter, r *http.Request) {
		webhookID := chi.URLParam(r, "webhookId")
		if removed := localstore.GetWebhookStore().RemoveWhere(func(item localstore.Webhook) bool { return item.ID == webhookID }); removed == 0 {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Webhook not found"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	})

	mux.MethodFunc("GET", "/webhooks/{webhookId}/deliveries", func(w http.ResponseWriter, r *http.Request) {
		webhookID := chi.URLParam(r, "webhookId")
		deliveries := localstore.GetWebhookDeliveryStore().All()
		filtered := make([]localstore.WebhookDelivery, 0, len(deliveries))
		for _, delivery := range deliveries {
			if delivery.WebhookID == webhookID {
				filtered = append(filtered, delivery)
			}
		}
		sort.Slice(filtered, func(i, j int) bool {
			return filtered[i].CreatedAt > filtered[j].CreatedAt
		})
		if len(filtered) > 100 {
			filtered = filtered[:100]
		}
		writeJSON(w, http.StatusOK, map[string]any{"deliveries": filtered})
	})

	mux.MethodFunc("POST", "/webhooks/{webhookId}/test", func(w http.ResponseWriter, r *http.Request) {
		webhookID := chi.URLParam(r, "webhookId")
		webhook, ok := localstore.GetWebhookStore().Find(func(item localstore.Webhook) bool { return item.ID == webhookID })
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "Webhook not found"})
			return
		}
		result := deliverWebhook(webhook, "test.ping", map[string]any{"test": true})
		writeJSON(w, http.StatusOK, result)
	})
}

func deliverWebhook(webhook localstore.Webhook, eventType string, payload map[string]any) map[string]any {
	bodyBytes, _ := json.Marshal(map[string]any{
		"event":     eventType,
		"timestamp": time.Now().Unix(),
		"data":      payload,
	})
	req, _ := http.NewRequest(http.MethodPost, webhook.URL, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "OpenClaw-Deck-Webhook/1.0")
	req.Header.Set("X-Deck-Event", eventType)
	if webhook.Secret != nil && *webhook.Secret != "" {
		mac := hmac.New(sha256.New, []byte(*webhook.Secret))
		mac.Write(bodyBytes)
		req.Header.Set("X-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	start := time.Now()
	statusCode := (*float64)(nil)
	var responseBody *string
	var errText *string
	success := false

	client := &http.Client{Timeout: 10 * time.Second}
	if res, err := client.Do(req); err != nil {
		msg := err.Error()
		errText = &msg
	} else {
		defer res.Body.Close()
		code := float64(res.StatusCode)
		statusCode = &code
		if body, readErr := io.ReadAll(res.Body); readErr == nil && len(body) > 0 {
			text := string(body)
			responseBody = &text
		}
		success = res.StatusCode >= 200 && res.StatusCode < 300
	}

	now := time.Now().UTC().Format(time.RFC3339)
	durationMs := float64(time.Since(start).Milliseconds())
	deliveryID := "wd-" + randomID(6)
	delivery := localstore.WebhookDelivery{
		ID:             deliveryID,
		WebhookID:      webhook.ID,
		EventType:      eventType,
		Payload:        string(bodyBytes),
		StatusCode:     statusCode,
		ResponseBody:   responseBody,
		Error:          errText,
		DurationMs:     durationMs,
		Attempt:        0,
		IsRetry:        false,
		ParentDelivery: nil,
		Success:        success,
		NextRetryAt:    nil,
		CreatedAt:      now,
	}
	localstore.GetWebhookDeliveryStore().Append(delivery)
	localstore.GetWebhookStore().UpdateItem(func(item localstore.Webhook) bool { return item.ID == webhook.ID }, func(item localstore.Webhook) localstore.Webhook {
		item.LastFiredAt = &now
		item.UpdatedAt = now
		if statusCode != nil {
			item.LastStatus = statusCode
		}
		if success {
			item.ConsecutiveFailures = 0
		} else {
			item.ConsecutiveFailures++
		}
		return item
	})

	return map[string]any{
		"success":    success,
		"statusCode": statusCode,
		"durationMs": durationMs,
		"error":      errText,
		"deliveryId": deliveryID,
	}
}
