
-- Bonk identity is established only by the server's direct HTTPS login response.
CREATE TABLE IF NOT EXISTS bonk_users(bonk_id TEXT PRIMARY KEY,username TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_sessions(token_hash TEXT PRIMARY KEY,bonk_id TEXT NOT NULL REFERENCES bonk_users(bonk_id),expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS admin_bonk_links(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,bonk_id TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS admin_session_identity(token_hash TEXT PRIMARY KEY REFERENCES admin_sessions(token_hash) ON DELETE CASCADE,user_session_hash TEXT NOT NULL REFERENCES user_sessions(token_hash) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS bonk_login_attempts(identity_hash TEXT PRIMARY KEY,window INTEGER NOT NULL,attempts INTEGER NOT NULL);

-- Old code-only sessions cannot be reused. Existing codes are retained.
DELETE FROM admin_sessions;
