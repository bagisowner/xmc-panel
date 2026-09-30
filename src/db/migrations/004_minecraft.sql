-- 004_minecraft.sql
-- Create Minecraft nodes, allocations, servers, and server settings tables

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  hostname TEXT,
  ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
  port INTEGER NOT NULL DEFAULT 8080,
  status TEXT NOT NULL DEFAULT 'ONLINE',
  location TEXT NOT NULL DEFAULT 'India',
  country TEXT NOT NULL DEFAULT 'India',
  max_memory_gb NUMERIC NOT NULL DEFAULT 32,
  allocated_memory_gb NUMERIC NOT NULL DEFAULT 0,
  max_cpu_cores INTEGER NOT NULL DEFAULT 8,
  allocated_cpu_cores INTEGER NOT NULL DEFAULT 0,
  max_disk_gb NUMERIC NOT NULL DEFAULT 200,
  allocated_disk_gb NUMERIC NOT NULL DEFAULT 0,
  port_range TEXT NOT NULL DEFAULT '25565-25600',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daemon_status TEXT NOT NULL DEFAULT 'Connected',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  software TEXT NOT NULL DEFAULT 'Paper',
  version TEXT NOT NULL DEFAULT '1.21.1',
  java_version TEXT NOT NULL DEFAULT '21',
  status TEXT NOT NULL DEFAULT 'Offline',
  memory_limit_gb NUMERIC NOT NULL DEFAULT 4 CHECK (memory_limit_gb > 0),
  cpu_limit_cores INTEGER NOT NULL DEFAULT 2 CHECK (cpu_limit_cores > 0),
  disk_limit_gb NUMERIC NOT NULL DEFAULT 15 CHECK (disk_limit_gb > 0),
  primary_port INTEGER NOT NULL,
  startup_command TEXT,
  jvm_flags TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_world TEXT NOT NULL DEFAULT 'world',
  auto_restart TEXT NOT NULL DEFAULT 'OnCrash',
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  container_id TEXT,
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS allocations (
  id TEXT PRIMARY KEY,
  node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
  ip_address TEXT NOT NULL DEFAULT '0.0.0.0',
  port INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Minecraft Default',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS server_members (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'subuser',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT server_members_unique UNIQUE (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS server_settings (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  crash_detection BOOLEAN NOT NULL DEFAULT TRUE,
  auto_save_interval INTEGER NOT NULL DEFAULT 5,
  query_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rcon_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rcon_port INTEGER,
  rcon_password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT server_settings_server_id_unique UNIQUE (server_id)
);

CREATE TABLE IF NOT EXISTS java_runtimes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  major INTEGER NOT NULL,
  vendor TEXT NOT NULL DEFAULT 'Eclipse Adoptium (Temurin)',
  path TEXT NOT NULL,
  directory TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Installed',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  size_formatted TEXT NOT NULL DEFAULT '0 MB',
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
