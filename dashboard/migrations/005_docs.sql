CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('summary','plan','spec','manual','draft')),
  content TEXT NOT NULL,
  source_session TEXT,
  source_agent TEXT,
  keywords TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'zh',
  extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);
CREATE INDEX IF NOT EXISTS idx_docs_extracted_at ON docs(extracted_at DESC);
