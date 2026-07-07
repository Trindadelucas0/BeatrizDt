CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS session_sid_key ON session (sid);

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_key VARCHAR(64) NOT NULL,
  preference_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, preference_key)
);

CREATE TABLE IF NOT EXISTS app_assets (
  asset_key VARCHAR(128) PRIMARY KEY,
  mime_type VARCHAR(64) NOT NULL,
  content BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
