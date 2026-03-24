-- Device identity for Ed25519 authentication with the Gateway.
-- Singleton row (id=1) stores the keypair and optional device token.

CREATE TABLE IF NOT EXISTS device_identity (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  device_id        TEXT NOT NULL,
  public_key_pem   TEXT NOT NULL,
  private_key_pem  TEXT NOT NULL,
  device_token     TEXT,
  created_at_ms    INTEGER NOT NULL
);
