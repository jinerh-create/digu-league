import type { Player, Match, Game, PlayerStats } from './types';

export async function getPlayers(db: D1Database): Promise<Player[]> {
  const result = await db
    .prepare('SELECT * FROM players ORDER BY joined_at ASC')
    .all<Player>();
  return result.results;
}

export async function getActivePlayers(db: D1Database): Promise<Player[]> {
  const result = await db
    .prepare('SELECT * FROM players WHERE active = 1 ORDER BY name ASC')
    .all<Player>();
  return result.results;
}

export async function getPlayer(db: D1Database, id: string): Promise<Player | null> {
  return db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Player>();
}

export async function createPlayer(
  db: D1Database,
  id: string,
  name: string,
  joined_at: string
): Promise<void> {
  await db
    .prepare('INSERT INTO players (id, name, joined_at) VALUES (?, ?, ?)')
    .bind(id, name, joined_at)
    .run();
}

export async function updatePlayerAvatar(
  db: D1Database,
  id: string,
  avatar_b64: string
): Promise<void> {
  await db
    .prepare('UPDATE players SET avatar_b64 = ? WHERE id = ?')
    .bind(avatar_b64, id)
    .run();
}

export async function updatePlayerActive(
  db: D1Database,
  id: string,
  active: number
): Promise<void> {
  await db.prepare('UPDATE players SET active = ? WHERE id = ?').bind(active, id).run();
}

export async function getMatches(db: D1Database, limit = 50): Promise<Match[]> {
  const result = await db
    .prepare(
      `SELECT m.*,
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar,
        pw.name AS winner_name
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       ORDER BY m.started_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Match>();
  return result.results;
}

export async function getMatch(db: D1Database, id: string): Promise<Match | null> {
  return db
    .prepare(
      `SELECT m.*,
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar,
        pw.name AS winner_name
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       WHERE m.id = ?`
    )
    .bind(id)
    .first<Match>();
}

export async function getActiveMatch(db: D1Database): Promise<Match | null> {
  return db
    .prepare(
      `SELECT m.*,
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       WHERE m.completed_at IS NULL
       ORDER BY m.started_at DESC
       LIMIT 1`
    )
    .first<Match>();
}

export async function createMatch(
  db: D1Database,
  id: string,
  player1_id: string,
  player2_id: string,
  target_score: number,
  started_at: string
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO matches (id, player1_id, player2_id, target_score, started_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, player1_id, player2_id, target_score, started_at)
    .run();
}

export async function completeMatch(
  db: D1Database,
  id: string,
  winner_id: string,
  completed_at: string
): Promise<void> {
  await db
    .prepare('UPDATE matches SET winner_id = ?, completed_at = ? WHERE id = ?')
    .bind(winner_id, completed_at, id)
    .run();
}

export async function getGames(db: D1Database, match_id: string): Promise<Game[]> {
  const result = await db
    .prepare('SELECT * FROM games WHERE match_id = ? ORDER BY round_number ASC')
    .bind(match_id)
    .all<Game>();
  return result.results;
}

export async function addGame(db: D1Database, game: Game): Promise<void> {
  await db
    .prepare(
      `INSERT INTO games
        (id, match_id, round_number, winner_id, loser_id, knocker_id,
         winner_deadwood, loser_deadwood, is_gin, is_undercut, score_awarded, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      game.id,
      game.match_id,
      game.round_number,
      game.winner_id,
      game.loser_id,
      game.knocker_id,
      game.winner_deadwood,
      game.loser_deadwood,
      game.is_gin,
      game.is_undercut,
      game.score_awarded,
      game.timestamp
    )
    .run();
}

export async function computePlayerStats(db: D1Database): Promise<PlayerStats[]> {
  const players = await getPlayers(db);
  const matchesResult = await db
    .prepare('SELECT * FROM matches WHERE completed_at IS NOT NULL')
    .all<Match>();
  const gamesResult = await db.prepare('SELECT * FROM games').all<Game>();

  const matches = matchesResult.results;
  const games = gamesResult.results;

  return players.map((p) => {
    const playerMatches = matches.filter(
      (m) => m.player1_id === p.id || m.player2_id === p.id
    );
    const playerGames = games.filter(
      (g) => g.winner_id === p.id || g.loser_id === p.id
    );
    const wonMatches = matches.filter((m) => m.winner_id === p.id);
    const wonGames = games.filter((g) => g.winner_id === p.id);
    const ginGames = games.filter((g) => g.winner_id === p.id && g.is_gin === 1);
    const undercutGames = games.filter((g) => g.winner_id === p.id && g.is_undercut === 1);
    const totalPts = wonGames.reduce((sum, g) => sum + g.score_awarded, 0);
    const biggest = wonGames.reduce((max, g) => Math.max(max, g.score_awarded), 0);

    return {
      player_id: p.id,
      name: p.name,
      avatar_b64: p.avatar_b64,
      matches_played: playerMatches.length,
      matches_won: wonMatches.length,
      matches_lost: playerMatches.length - wonMatches.length,
      games_played: playerGames.length,
      games_won: wonGames.length,
      total_points_scored: totalPts,
      gin_count: ginGames.length,
      undercut_count: undercutGames.length,
      biggest_hand: biggest,
      avg_points_per_game:
        wonGames.length > 0 ? Math.round(totalPts / wonGames.length) : 0,
      win_rate:
        playerMatches.length > 0
          ? Math.round((wonMatches.length / playerMatches.length) * 1000) / 10
          : 0,
    };
  });
}
