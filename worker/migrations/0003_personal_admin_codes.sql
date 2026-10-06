CREATE TABLE IF NOT EXISTS admin_credentials(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,salt TEXT,code_hash TEXT,invitation_hash TEXT);
DELETE FROM admin_sessions;
CREATE TABLE IF NOT EXISTS admin_login_attempts(account_id TEXT PRIMARY KEY,window INTEGER NOT NULL,attempts INTEGER NOT NULL);
