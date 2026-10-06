CREATE TABLE IF NOT EXISTS admin_account_metadata(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,created_at TEXT);
INSERT OR IGNORE INTO admin_account_metadata(account_id,created_at) SELECT a.id,(SELECT MAX(l.created_at) FROM activity_logs l WHERE l.action='created_admin' AND l.account_name=a.name COLLATE NOCASE) FROM admin_accounts a;
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_account ON activity_logs(account_name);
