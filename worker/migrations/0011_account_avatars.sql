-- Cosmetic data only; never used for account identity or permissions.
CREATE TABLE IF NOT EXISTS bonk_account_avatars(bonk_id TEXT PRIMARY KEY REFERENCES bonk_users(bonk_id) ON DELETE CASCADE,skin_code TEXT);
