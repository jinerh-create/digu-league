CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_b64 TEXT,
  joined_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  player1_id TEXT NOT NULL REFERENCES players(id),
  player2_id TEXT NOT NULL REFERENCES players(id),
  target_score INTEGER NOT NULL,
  winner_id TEXT REFERENCES players(id),
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  round_number INTEGER NOT NULL,
  winner_id TEXT NOT NULL REFERENCES players(id),
  loser_id TEXT NOT NULL REFERENCES players(id),
  knocker_id TEXT NOT NULL REFERENCES players(id),
  winner_deadwood INTEGER NOT NULL,
  loser_deadwood INTEGER NOT NULL,
  is_gin INTEGER NOT NULL DEFAULT 0,
  is_undercut INTEGER NOT NULL DEFAULT 0,
  score_awarded INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_games_match ON games(match_id);
CREATE INDEX idx_matches_player1 ON matches(player1_id);
CREATE INDEX idx_matches_player2 ON matches(player2_id);
