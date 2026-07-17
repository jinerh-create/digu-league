-- Player verification. Gold verified badge.
-- Rule: every player who already exists is grandfathered in as verified; players
-- created AFTER this migration start unverified and must request verification,
-- which an admin approves.
ALTER TABLE players ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN verify_requested INTEGER NOT NULL DEFAULT 0;

-- Grandfather every current player as verified.
UPDATE players SET verified = 1;
