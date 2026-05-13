ALTER TABLE matches ADD COLUMN team1_name TEXT;
ALTER TABLE matches ADD COLUMN team2_name TEXT;
ALTER TABLE matches ADD COLUMN team1_player2_id TEXT REFERENCES players(id);
ALTER TABLE matches ADD COLUMN team2_player2_id TEXT REFERENCES players(id);
