-- 005_backups.sql
-- Create backups table

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Completed',
  file_path TEXT NOT NULL,
  checksum TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
