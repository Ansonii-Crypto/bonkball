ALTER TABLE assessments ADD COLUMN class_name TEXT;
ALTER TABLE assessments ADD COLUMN playstyle TEXT;
ALTER TABLE assessments ADD COLUMN strengths TEXT;
ALTER TABLE assessments ADD COLUMN weaknesses TEXT;
-- Only the current matching snapshot can safely recover these previously unsaved fields.
UPDATE assessments SET class_name=(SELECT class_name FROM players WHERE players.id=assessments.player_id),playstyle=(SELECT playstyle FROM players WHERE players.id=assessments.player_id),strengths=(SELECT strengths FROM players WHERE players.id=assessments.player_id),weaknesses=(SELECT weaknesses FROM players WHERE players.id=assessments.player_id) WHERE id=(SELECT a.id FROM assessments a JOIN players p ON p.id=a.player_id WHERE a.player_id=assessments.player_id AND a.assessed_at=p.assessed_at ORDER BY a.id DESC LIMIT 1);
