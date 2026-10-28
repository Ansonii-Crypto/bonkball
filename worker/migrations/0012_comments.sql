CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,author_bonk_id TEXT NOT NULL REFERENCES bonk_users(bonk_id),body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(player_id,assessment_id,id DESC);
CREATE TABLE IF NOT EXISTS comment_post_attempts(bonk_id TEXT PRIMARY KEY REFERENCES bonk_users(bonk_id),window INTEGER NOT NULL,attempts INTEGER NOT NULL);
