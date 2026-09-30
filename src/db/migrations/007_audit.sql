-- 007_audit.sql
-- Create audit logs, security events, and alert tables

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  trigger_value NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
