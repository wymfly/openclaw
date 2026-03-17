## ADDED Requirements

### Requirement: Webhook CRUD

The webhook engine panel SHALL support creating, reading, updating, and deleting webhooks with URL, event subscriptions, and shared secret. Webhook configuration SHALL be persisted in the SQLite projection store.

#### Scenario: Create a webhook

- **WHEN** the user fills in a webhook URL, selects event types to subscribe to, and provides an optional shared secret
- **THEN** the panel SHALL persist the webhook configuration in SQLite and display it in the webhook list

#### Scenario: Delete a webhook

- **WHEN** the user confirms deletion of a webhook
- **THEN** the panel SHALL remove the webhook from SQLite and stop delivering events to that URL

### Requirement: HMAC-SHA256 Signing

All webhook deliveries SHALL include an `X-Signature-256` header containing an HMAC-SHA256 signature computed from the request body and the webhook's shared secret.

#### Scenario: Signed delivery

- **WHEN** a subscribed event occurs and the webhook has a shared secret configured
- **THEN** the delivery request SHALL include an `X-Signature-256` header with the HMAC-SHA256 hex digest of the JSON body using the shared secret as key

### Requirement: Delivery History

The panel SHALL display delivery history for each webhook showing HTTP status, response time, and delivery timestamp.

#### Scenario: View delivery history

- **WHEN** the user expands a webhook's delivery history
- **THEN** the panel SHALL display a list of past deliveries with timestamp, HTTP response status code, response time in milliseconds, and success/failure indicator

### Requirement: Retry with Exponential Backoff

Failed webhook deliveries (non-2xx response or timeout) SHALL be retried with exponential backoff up to a maximum retry count.

#### Scenario: Retry failed delivery

- **WHEN** a webhook delivery receives a 500 response
- **THEN** the engine SHALL retry the delivery with exponential backoff (1s, 2s, 4s, 8s, ...) up to 5 attempts, recording each attempt in the delivery history

### Requirement: Test Delivery

The panel SHALL allow sending a test delivery to a webhook URL to verify connectivity and signature validation.

#### Scenario: Send test delivery

- **WHEN** the user clicks "Test" on a webhook
- **THEN** the panel SHALL send a test payload to the webhook URL with a valid HMAC signature and display the response status
