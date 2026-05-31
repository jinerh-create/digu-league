-- Performance indexes for foreign keys and common filter columns
-- matches: completed_at is filtered on almost every query
CREATE INDEX IF NOT EXISTS idx_matches_completed ON matches(completed_at);

-- matches: winner_id JOIN in getMatches / getMatch
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);

-- matches: team player lookups used in computePlayerStats and getPlayerMatches
CREATE INDEX IF NOT EXISTS idx_matches_team1p2 ON matches(team1_player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_team2p2 ON matches(team2_player2_id);

-- matches: season filter used in leaderboard/stats
CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_id);

-- matches: month filter — strftime on started_at
CREATE INDEX IF NOT EXISTS idx_matches_started ON matches(started_at);

-- games: winner/loser lookups
CREATE INDEX IF NOT EXISTS idx_games_winner ON games(winner_id);
CREATE INDEX IF NOT EXISTS idx_games_loser  ON games(loser_id);

-- games: gin player lookup
CREATE INDEX IF NOT EXISTS idx_games_gin_player ON games(gin_player_id);

-- reactions: match_id foreign key
CREATE INDEX IF NOT EXISTS idx_reactions_match ON match_reactions(match_id);
