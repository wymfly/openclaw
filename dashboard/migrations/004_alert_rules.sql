CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  condition TEXT NOT NULL,
  threshold REAL NOT NULL,
  action TEXT NOT NULL DEFAULT 'toast',
  cooldown_ms INTEGER NOT NULL DEFAULT 300000,
  last_fired_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
