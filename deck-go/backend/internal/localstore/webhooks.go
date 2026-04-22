package localstore

type Webhook struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	URL                 string   `json:"url"`
	Secret              *string  `json:"secret"`
	Events              []string `json:"events"`
	Enabled             bool     `json:"enabled"`
	ConsecutiveFailures float64  `json:"consecutiveFailures"`
	LastFiredAt         *string  `json:"lastFiredAt"`
	LastStatus          *float64 `json:"lastStatus"`
	CreatedAt           string   `json:"createdAt"`
	UpdatedAt           string   `json:"updatedAt"`
}

type WebhookDelivery struct {
	ID             string   `json:"id"`
	WebhookID      string   `json:"webhookId"`
	EventType      string   `json:"eventType"`
	Payload        string   `json:"payload"`
	StatusCode     *float64 `json:"statusCode"`
	ResponseBody   *string  `json:"responseBody"`
	Error          *string  `json:"error"`
	DurationMs     float64  `json:"durationMs"`
	Attempt        float64  `json:"attempt"`
	IsRetry        bool     `json:"isRetry"`
	ParentDelivery *string  `json:"parentDeliveryId"`
	Success        bool     `json:"success"`
	NextRetryAt    *float64 `json:"nextRetryAt"`
	CreatedAt      string   `json:"createdAt"`
}

func GetWebhookStore() *SliceStore[Webhook] {
	return NewSliceStore[Webhook]("webhooks.json")
}

func GetWebhookDeliveryStore() *SliceStore[WebhookDelivery] {
	return NewSliceStore[WebhookDelivery]("webhook-deliveries.json")
}
