CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_records (
  competencia VARCHAR(7) PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by VARCHAR(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS record_revisions (
  id SERIAL PRIMARY KEY,
  competencia VARCHAR(7) NOT NULL,
  revision INT NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  UNIQUE (competencia, revision)
);

CREATE TABLE IF NOT EXISTS record_backups (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monthly_records_updated_at ON monthly_records (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_revisions_competencia ON record_revisions (competencia);
