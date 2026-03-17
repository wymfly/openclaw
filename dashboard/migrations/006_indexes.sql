-- Performance indexes for frequently-queried columns.
-- Covers hot paths identified during SQLite index audit (P3 Task 15).

-- outbox: cleanup query uses created_at; projection polling uses id (PK, already indexed).
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox(created_at);

-- webhooks: filtered by enabled status.
CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);

-- webhook_deliveries: retry processor queries by next_retry_at for pending retries.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at)
  WHERE next_retry_at IS NOT NULL;

-- webhook_deliveries: lookup by parent delivery for retry chain traversal.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_parent ON webhook_deliveries(parent_delivery_id)
  WHERE parent_delivery_id IS NOT NULL;

-- budget_rules: queried by scope + agent_id for budget checks.
CREATE INDEX IF NOT EXISTS idx_budget_rules_scope ON budget_rules(scope, agent_id);

-- alert_rules: engine queries by entity_type + enabled (see alert-engine.ts:146).
CREATE INDEX IF NOT EXISTS idx_alert_rules_entity_enabled ON alert_rules(entity_type, enabled);
