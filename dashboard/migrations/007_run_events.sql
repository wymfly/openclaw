-- Run event persistence for the Execution Monitor.
-- Stores streaming execution events keyed by run_id + seq.

CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  stream TEXT NOT NULL,
  data TEXT NOT NULL,
  agent_id TEXT,
  session_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_run_events_agent_ts ON run_events(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_run_events_session ON run_events(session_key, created_at);
