-- Emoji reactions on completed matches (public, no auth)
CREATE TABLE IF NOT EXISTS match_reactions (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reactions_match ON match_reactions(match_id);

-- Upcoming / scheduled fixtures (admin creates)
CREATE TABLE IF NOT EXISTS scheduled_matches (
  id TEXT PRIMARY KEY,
  player1_id TEXT NOT NULL REFERENCES players(id),
  player2_id TEXT NOT NULL REFERENCES players(id),
  team1_player2_id TEXT REFERENCES players(id),
  team2_player2_id TEXT REFERENCES players(id),
  team1_name TEXT,
  team2_name TEXT,
  scheduled_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scheduled_at ON scheduled_matches(scheduled_at);
