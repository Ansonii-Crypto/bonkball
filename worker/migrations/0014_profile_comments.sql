-- Profiles can receive comments before they have any player assessments.
CREATE TABLE comments_new(id INTEGER PRIMARY KEY AUTOINCREMENT,player_id TEXT REFERENCES players(id) ON DELETE CASCADE,profile_bonk_id TEXT REFERENCES bonk_users(bonk_id) ON DELETE CASCADE,assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,parent_id INTEGER REFERENCES comments_new(id) ON DELETE CASCADE,author_bonk_id TEXT REFERENCES bonk_users(bonk_id),body TEXT,created_at TEXT NOT NULL,deleted_at TEXT,CHECK((player_id IS NOT NULL) <> (profile_bonk_id IS NOT NULL)),CHECK(assessment_id IS NULL OR player_id IS NOT NULL),CHECK((deleted_at IS NULL AND author_bonk_id IS NOT NULL AND body IS NOT NULL AND length(body) BETWEEN 1 AND 2000) OR (deleted_at IS NOT NULL AND author_bonk_id IS NULL AND body IS NULL)));
INSERT INTO comments_new(id,player_id,assessment_id,parent_id,author_bonk_id,body,created_at,deleted_at) SELECT id,player_id,assessment_id,parent_id,author_bonk_id,body,created_at,deleted_at FROM comments;
-- Pin known account profiles to their immutable identity, including all replies.
UPDATE comments_new SET profile_bonk_id=(SELECT u.bonk_id FROM players p JOIN bonk_users u ON u.username=trim(p.name) COLLATE NOCASE WHERE p.id=comments_new.player_id LIMIT 1),player_id=NULL WHERE assessment_id IS NULL AND EXISTS(SELECT 1 FROM players p JOIN bonk_users u ON u.username=trim(p.name) COLLATE NOCASE WHERE p.id=comments_new.player_id);
-- Preserve the high-water mark even if the newest comments were deleted.
UPDATE sqlite_sequence SET seq=MAX(seq,COALESCE((SELECT seq FROM sqlite_sequence WHERE name='comments'),0)) WHERE name='comments_new';
DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;
CREATE INDEX idx_comments_thread ON comments(player_id,assessment_id,parent_id,id DESC);
CREATE INDEX idx_comments_profile ON comments(profile_bonk_id,parent_id,id DESC);
CREATE INDEX idx_comments_parent ON comments(parent_id,id DESC);
