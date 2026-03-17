CREATE TABLE IF NOT EXISTS budget_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  agent_id TEXT,
  task_id TEXT,
  dimension TEXT NOT NULL CHECK(dimension IN ('tokensIn','tokensOut','totalTokens','cost')),
  warn_threshold REAL,
  over_threshold REAL,
  period TEXT NOT NULL DEFAULT 'monthly',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
