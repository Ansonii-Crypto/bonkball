-- Existing duplicate names must be renamed or removed before this index can be added.
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_name ON players(trim(name) COLLATE NOCASE);
