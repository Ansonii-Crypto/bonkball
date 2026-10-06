CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,name TEXT NOT NULL,class_name TEXT DEFAULT '',overall_tier TEXT NOT NULL DEFAULT 'B',control INTEGER NOT NULL DEFAULT 0,execution INTEGER NOT NULL DEFAULT 0,defending INTEGER NOT NULL DEFAULT 0,reaction_time INTEGER NOT NULL DEFAULT 0,chemistry INTEGER NOT NULL DEFAULT 0,game_sense INTEGER NOT NULL DEFAULT 0,playstyle TEXT DEFAULT '',strengths TEXT DEFAULT '',weaknesses TEXT DEFAULT '',assessed_at TEXT NOT NULL,locked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS assessments(id INTEGER PRIMARY KEY AUTOINCREMENT,player_id TEXT NOT NULL,assessed_at TEXT NOT NULL,overall_tier TEXT NOT NULL,control INTEGER NOT NULL,execution INTEGER NOT NULL,defending INTEGER NOT NULL,reaction_time INTEGER NOT NULL,chemistry INTEGER NOT NULL,game_sense INTEGER NOT NULL,total INTEGER NOT NULL,notes TEXT DEFAULT '',FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_assessments_player ON assessments(player_id);

CREATE TABLE IF NOT EXISTS admin_accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,is_primary INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO admin_accounts(id,name,is_primary) VALUES('primary-zimble','Zimble',1);
CREATE TABLE IF NOT EXISTS admin_sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL,account_id TEXT REFERENCES admin_accounts(id));
CREATE TABLE IF NOT EXISTS activity_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,player_id TEXT,player_name TEXT,assessed_at TEXT,assessment_id INTEGER,account_name TEXT,created_at TEXT NOT NULL);

-- Existing duplicate names must be renamed or removed before this index can be added.
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_name ON players(trim(name) COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS admin_credentials(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,salt TEXT,code_hash TEXT,invitation_hash TEXT);
CREATE TABLE IF NOT EXISTS admin_login_attempts(account_id TEXT PRIMARY KEY,window INTEGER NOT NULL,attempts INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS admin_invitations(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,token TEXT NOT NULL,expires_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS admin_account_metadata(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,created_at TEXT);
INSERT OR IGNORE INTO admin_account_metadata(account_id,created_at) SELECT a.id,(SELECT MAX(l.created_at) FROM activity_logs l WHERE l.action='created_admin' AND l.account_name=a.name COLLATE NOCASE) FROM admin_accounts a;
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_account ON activity_logs(account_name);

CREATE TABLE IF NOT EXISTS admin_code_requests(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,requested_at TEXT NOT NULL);
