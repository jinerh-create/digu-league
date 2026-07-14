-- Classic (casual) matches: separate from all league stats/records/leaderboard.
-- is_classic on matches marks a casual match; is_guest on players marks a
-- one-off guest created for a classic match (kept out of league player lists).
ALTER TABLE matches ADD COLUMN is_classic INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_matches_classic ON matches(is_classic);
