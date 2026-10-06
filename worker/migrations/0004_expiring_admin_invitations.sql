CREATE TABLE IF NOT EXISTS admin_invitations(account_id TEXT PRIMARY KEY REFERENCES admin_accounts(id) ON DELETE CASCADE,token TEXT NOT NULL,expires_at INTEGER NOT NULL);
UPDATE admin_credentials SET invitation_hash=NULL WHERE code_hash IS NULL;
