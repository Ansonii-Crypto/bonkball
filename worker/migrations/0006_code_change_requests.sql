CREATE TABLE IF NOT EXISTS admin_code_requests(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,requested_at TEXT NOT NULL);
