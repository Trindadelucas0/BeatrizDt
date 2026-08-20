CREATE TABLE IF NOT EXISTS fiscal_monthly_records (
  competencia VARCHAR(7) PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by VARCHAR(128) NOT NULL
);

CREATE TABLE IF NOT EXISTS fiscal_record_revisions (
  id SERIAL PRIMARY KEY,
  competencia VARCHAR(7) NOT NULL,
  revision INT NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  UNIQUE (competencia, revision)
);

CREATE TABLE IF NOT EXISTS fiscal_record_backups (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiscal_monthly_records_updated_at ON fiscal_monthly_records (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_record_revisions_competencia ON fiscal_record_revisions (competencia);
