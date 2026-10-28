CREATE TABLE comments_new(id INTEGER PRIMARY KEY AUTOINCREMENT,player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,parent_id INTEGER REFERENCES comments_new(id) ON DELETE CASCADE,author_bonk_id TEXT REFERENCES bonk_users(bonk_id),body TEXT,created_at TEXT NOT NULL,deleted_at TEXT,CHECK((deleted_at IS NULL AND author_bonk_id IS NOT NULL AND body IS NOT NULL AND length(body) BETWEEN 1 AND 2000) OR (deleted_at IS NOT NULL AND author_bonk_id IS NULL AND body IS NULL)));
INSERT INTO comments_new(id,player_id,assessment_id,author_bonk_id,body,created_at) SELECT id,player_id,assessment_id,author_bonk_id,body,created_at FROM comments;
DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;
CREATE INDEX idx_comments_thread ON comments(player_id,assessment_id,parent_id,id DESC);
CREATE INDEX idx_comments_parent ON comments(parent_id,id DESC);
