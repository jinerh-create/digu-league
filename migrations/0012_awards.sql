-- Special Annual Awards — one winner per award per YEAR, manually assigned by an
-- admin (matching the house rule that honours like Digu King are awarded, never
-- auto-assigned). player_id is nullable because some awards (Club of the Year)
-- may go to a non-player recipient captured in recipient_name.
CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  award_key TEXT NOT NULL,
  player_id TEXT REFERENCES players(id),
  recipient_name TEXT,
  note TEXT,
  awarded_at TEXT NOT NULL,
  UNIQUE (year, award_key)
);
CREATE INDEX IF NOT EXISTS idx_awards_year ON awards(year);
