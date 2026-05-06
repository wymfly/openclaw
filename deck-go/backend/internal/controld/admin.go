package controld

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"slices"
	"time"

	httpapi "github.com/openclaw/openclaw/deck-go/backend/internal/api/http"
	"github.com/openclaw/openclaw/deck-go/backend/internal/localstore"
)

type webhookAdapter struct{}

func (a webhookAdapter) ListWebhooks(ctx context.Context) (map[string]any, error) {
	webhooks := localstore.GetWebhookStore().All()
	slices.SortFunc(webhooks, func(left, right localstore.Webhook) int {
		switch {
		case left.CreatedAt > right.CreatedAt:
			return -1
		case left.CreatedAt < right.CreatedAt:
			return 1
		default:
			return 0
		}
	})
	items := make([]map[string]any, 0, len(webhooks))
	for _, webhook := range webhooks {
		items = append(items, webhookToMap(webhook))
	}
	return map[string]any{"webhooks": items}, nil
}

func (a webhookAdapter) CreateWebhook(ctx context.Context, input httpapi.WebhookCreateInput) (map[string]any, error) {
	if err := validateWebhookURL(input.URL); err != nil {
		return nil, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	webhook := localstore.Webhook{
		ID:                  "wh-" + randomHexID(6),
		Name:                input.Name,
		URL:                 input.URL,
		Secret:              input.Secret,
		Events:              input.Events,
		Enabled:             enabled,
		ConsecutiveFailures: 0,
		LastFiredAt:         nil,
		LastStatus:          nil,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	localstore.GetWebhookStore().Append(webhook)
	return webhookToMap(webhook), nil
}

func (a webhookAdapter) UpdateWebhook(ctx context.Context, webhookID string, patch httpapi.WebhookPatchInput) (any, bool, error) {
	store := localstore.GetWebhookStore()
	if _, ok := store.Find(func(item localstore.Webhook) bool { return item.ID == webhookID }); !ok {
		return nil, false, nil
	}
	if patch.URL != nil {
		if err := validateWebhookURL(*patch.URL); err != nil {
			return nil, true, err
		}
	}
	store.UpdateItem(func(item localstore.Webhook) bool { return item.ID == webhookID }, func(item localstore.Webhook) localstore.Webhook {
		item.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if patch.Name != nil {
			item.Name = *patch.Name
		}
		if patch.URL != nil {
			item.URL = *patch.URL
		}
		if patch.Secret != nil {
			item.Secret = *patch.Secret
		}
		if patch.Events != nil {
			item.Events = *patch.Events
		}
		if patch.Enabled != nil {
			item.Enabled = *patch.Enabled
		}
		return item
	})
	updated, _ := store.Find(func(item localstore.Webhook) bool { return item.ID == webhookID })
	return webhookToMap(updated), true, nil
}

func (a webhookAdapter) DeleteWebhook(ctx context.Context, webhookID string) (bool, error) {
	removed := localstore.GetWebhookStore().RemoveWhere(func(item localstore.Webhook) bool { return item.ID == webhookID })
	return removed > 0, nil
}

func (a webhookAdapter) ListWebhookDeliveries(ctx context.Context, webhookID string) (map[string]any, error) {
	deliveries := localstore.GetWebhookDeliveryStore().All()
	filtered := make([]localstore.WebhookDelivery, 0, len(deliveries))
	for _, delivery := range deliveries {
		if delivery.WebhookID == webhookID {
			filtered = append(filtered, delivery)
		}
	}
	slices.SortFunc(filtered, func(left, right localstore.WebhookDelivery) int {
		switch {
		case left.CreatedAt > right.CreatedAt:
			return -1
		case left.CreatedAt < right.CreatedAt:
			return 1
		default:
			return 0
		}
	})
	if len(filtered) > 100 {
		filtered = filtered[:100]
	}
	items := make([]map[string]any, 0, len(filtered))
	for _, delivery := range filtered {
		items = append(items, webhookDeliveryToMap(delivery))
	}
	return map[string]any{"deliveries": items}, nil
}

func (a webhookAdapter) TestWebhook(ctx context.Context, webhookID string) (map[string]any, bool, error) {
	webhook, ok := localstore.GetWebhookStore().Find(func(item localstore.Webhook) bool { return item.ID == webhookID })
	if !ok {
		return nil, false, nil
	}
	payload, err := deliverWebhookNow(webhook, "test.ping", map[string]any{"test": true})
	if err != nil {
		return nil, true, err
	}
	return payload, true, nil
}

func errStringValue(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func deliverWebhookNow(webhook localstore.Webhook, eventType string, payload map[string]any) (map[string]any, error) {
	bodyBytes, err := json.Marshal(map[string]any{
		"event":     eventType,
		"timestamp": time.Now().Unix(),
		"data":      payload,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, webhook.URL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "OpenClaw-Deck-Webhook/1.0")
	req.Header.Set("X-Deck-Event", eventType)
	if webhook.Secret != nil && *webhook.Secret != "" {
		mac := hmac.New(sha256.New, []byte(*webhook.Secret))
		_, _ = mac.Write(bodyBytes)
		req.Header.Set("X-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	startedAt := time.Now()
	var (
		statusCode   *float64
		responseBody *string
		errText      *string
		success      bool
	)
	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		message := err.Error()
		errText = &message
	} else {
		defer res.Body.Close()
		code := float64(res.StatusCode)
		statusCode = &code
		if raw, readErr := io.ReadAll(res.Body); readErr == nil && len(raw) > 0 {
			text := string(raw)
			responseBody = &text
		}
		success = res.StatusCode >= 200 && res.StatusCode < 300
	}

	now := time.Now().UTC().Format(time.RFC3339)
	durationMs := float64(time.Since(startedAt).Milliseconds())
	deliveryID := "wd-" + randomHexID(6)
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
	}, nil
}

func webhookToMap(webhook localstore.Webhook) map[string]any {
	var secret any
	if webhook.Secret != nil && *webhook.Secret != "" {
		secret = "***redacted"
	}
	return map[string]any{
		"id":                  webhook.ID,
		"name":                webhook.Name,
		"url":                 webhook.URL,
		"secret":              secret,
		"events":              webhook.Events,
		"enabled":             webhook.Enabled,
		"consecutiveFailures": webhook.ConsecutiveFailures,
		"lastFiredAt":         webhook.LastFiredAt,
		"lastStatus":          webhook.LastStatus,
		"createdAt":           webhook.CreatedAt,
		"updatedAt":           webhook.UpdatedAt,
	}
}

func validateWebhookURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	if parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return errors.New("webhook url must be http or https")
	}
	return nil
}

func webhookDeliveryToMap(delivery localstore.WebhookDelivery) map[string]any {
	return map[string]any{
		"id":               delivery.ID,
		"webhookId":        delivery.WebhookID,
		"eventType":        delivery.EventType,
		"payload":          delivery.Payload,
		"statusCode":       delivery.StatusCode,
		"responseBody":     delivery.ResponseBody,
		"error":            delivery.Error,
		"durationMs":       delivery.DurationMs,
		"attempt":          delivery.Attempt,
		"isRetry":          delivery.IsRetry,
		"parentDeliveryId": delivery.ParentDelivery,
		"success":          delivery.Success,
		"nextRetryAt":      delivery.NextRetryAt,
		"createdAt":        delivery.CreatedAt,
	}
}
