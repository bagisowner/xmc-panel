-- 009_indexes.sql
-- Create performance indexes for high-frequency queries

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_node_id ON servers(node_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);

CREATE INDEX IF NOT EXISTS idx_allocations_node_id ON allocations(node_id);
CREATE INDEX IF NOT EXISTS idx_allocations_server_id ON allocations(server_id);
CREATE INDEX IF NOT EXISTS idx_allocations_port ON allocations(port);

CREATE INDEX IF NOT EXISTS idx_backups_server_id ON backups(server_id);
CREATE INDEX IF NOT EXISTS idx_schedules_server_id ON schedules(server_id);
CREATE INDEX IF NOT EXISTS idx_jobs_server_id ON jobs(server_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_firestore_docs_collection ON firestore_documents(collection);
