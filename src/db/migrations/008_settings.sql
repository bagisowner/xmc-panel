-- 008_settings.sql
-- Create system settings, branding, user settings, economy, and document store tables

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branding_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  brand_name TEXT NOT NULL DEFAULT 'Xorvila',
  brand_logo TEXT NOT NULL DEFAULT '',
  custom_logos JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  sidebar_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
  audio_fx BOOLEAN NOT NULL DEFAULT TRUE,
  custom_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0.00,
  category TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC NOT NULL DEFAULT 5.0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_balances (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0.00,
  credits NUMERIC NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS firestore_documents (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection, id)
);

CREATE TABLE IF NOT EXISTS security_rules (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  allow_read TEXT NOT NULL DEFAULT 'authenticated',
  allow_write TEXT NOT NULL DEFAULT 'authenticated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
