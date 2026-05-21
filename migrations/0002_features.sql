-- Match comments
ALTER TABLE matches ADD COLUMN comment TEXT;

-- Seasons
CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT
);

ALTER TABLE matches ADD COLUMN season_id TEXT REFERENCES seasons(id);
