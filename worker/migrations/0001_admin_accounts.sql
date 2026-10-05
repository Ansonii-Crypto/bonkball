
CREATE TABLE IF NOT EXISTS admin_accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,is_primary INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO admin_accounts(id,name,is_primary) VALUES('primary-zimble','Zimble',1);
CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,account_id TEXT REFERENCES admin_accounts(id));
CREATE TABLE IF NOT EXISTS activity_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,player_id TEXT,player_name TEXT,assessed_at TEXT,assessment_id INTEGER,account_name TEXT,created_at TEXT NOT NULL);
