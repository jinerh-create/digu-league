import type { Player, Match, Game, PlayerStats, TeamStats } from './types';

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

export async function updatePlayerName(
  db: D1Database,
  id: string,
  name: string
): Promise<void> {
  await db.prepare('UPDATE players SET name = ? WHERE id = ?').bind(name, id).run();
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
        pw.name AS winner_name,
        p3.name AS team1_player2_name,
        p4.name AS team2_player2_name
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       LEFT JOIN players p3 ON p3.id = m.team1_player2_id
       LEFT JOIN players p4 ON p4.id = m.team2_player2_id
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
        pw.name AS winner_name,
        p3.name AS team1_player2_name,
        p4.name AS team2_player2_name
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       LEFT JOIN players p3 ON p3.id = m.team1_player2_id
       LEFT JOIN players p4 ON p4.id = m.team2_player2_id
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
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar,
        p3.name AS team1_player2_name,
        p4.name AS team2_player2_name
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players p3 ON p3.id = m.team1_player2_id
       LEFT JOIN players p4 ON p4.id = m.team2_player2_id
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
  started_at: string,
  team1_name?: string | null,
  team2_name?: string | null,
  team1_player2_id?: string | null,
  team2_player2_id?: string | null,
  max_rounds?: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO matches
        (id, player1_id, player2_id, target_score, started_at,
         team1_name, team2_name, team1_player2_id, team2_player2_id, max_rounds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, player1_id, player2_id, target_score, started_at,
      team1_name ?? null, team2_name ?? null,
      team1_player2_id ?? null, team2_player2_id ?? null,
      max_rounds ?? 0
    )
    .run();
}

export async function completeMatch(
  db: D1Database,
  id: string,
  winner_id: string | null,
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
         winner_deadwood, loser_deadwood, is_gin, is_undercut, score_awarded, timestamp,
         t1_p1_cards, t1_p2_cards, t2_p1_cards, t2_p2_cards, gin_player_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      game.id, game.match_id, game.round_number,
      game.winner_id, game.loser_id, game.knocker_id,
      game.winner_deadwood, game.loser_deadwood,
      game.is_gin, game.is_undercut, game.score_awarded, game.timestamp,
      game.t1_p1_cards ?? null, game.t1_p2_cards ?? null,
      game.t2_p1_cards ?? null, game.t2_p2_cards ?? null,
      game.gin_player_id ?? null
    )
    .run();
}

export async function computePlayerStats(db: D1Database, month?: string, matchType?: 'single' | 'team'): Promise<PlayerStats[]> {
  const players = await getPlayers(db);
  let baseWhere = 'completed_at IS NOT NULL';
  if (matchType === 'single') baseWhere += ' AND team1_player2_id IS NULL';
  else if (matchType === 'team') baseWhere += ' AND team1_player2_id IS NOT NULL';

  const matchesResult = month
    ? await db.prepare(`SELECT * FROM matches WHERE ${baseWhere} AND strftime('%Y-%m', started_at) = ?`).bind(month).all<Match>()
    : await db.prepare(`SELECT * FROM matches WHERE ${baseWhere}`).all<Match>();
  const matchIds = matchesResult.results.map(m => m.id);
  const gamesResult = matchIds.length > 0
    ? await db.prepare(`SELECT * FROM games WHERE match_id IN (${matchIds.map(() => '?').join(',')})`)
        .bind(...matchIds).all<Game>()
    : { results: [] as Game[] };

  const matches = matchesResult.results;
  const games = gamesResult.results;
  // lookup to check team membership for any game
  const matchById = new Map(matches.map(m => [m.id, m]));

  return players.map((p) => {
    // Include player whether they are captain or second player on a team
    const playerMatches = matches.filter(
      (m) => m.player1_id === p.id || m.player2_id === p.id ||
             m.team1_player2_id === p.id || m.team2_player2_id === p.id
    );

    const wonMatches = playerMatches.filter((m) => {
      if (!m.winner_id) return false;
      const onTeam1 = m.player1_id === p.id || m.team1_player2_id === p.id;
      // winner_id is always player1_id (team1 win) or player2_id (team2 win)
      const team1Won = m.winner_id === m.player1_id;
      return onTeam1 ? team1Won : !team1Won;
    });

    const drawnMatches = playerMatches.filter((m) => m.completed_at && !m.winner_id);

    // All games in matches this player participated in
    const playerGames = games.filter(g => {
      const m = matchById.get(g.match_id);
      if (!m) return g.winner_id === p.id || g.loser_id === p.id;
      return m.player1_id === p.id || m.player2_id === p.id ||
             m.team1_player2_id === p.id || m.team2_player2_id === p.id;
    });

    // Game wins: credit both team members when their team wins a round
    const wonGames = games.filter(g => {
      const m = matchById.get(g.match_id);
      if (!m) return g.winner_id === p.id;
      const onTeam1 = m.player1_id === p.id || m.team1_player2_id === p.id;
      const onTeam2 = m.player2_id === p.id || m.team2_player2_id === p.id;
      const team1WonGame = g.winner_id === m.player1_id;
      return (onTeam1 && team1WonGame) || (onTeam2 && !team1WonGame);
    });

    // Gin count: only the player who personally ginned
    const ginGames = games.filter(
      (g) => g.is_gin === 1 && (
        g.gin_player_id === p.id ||
        (!g.gin_player_id && g.winner_id === p.id)
      )
    );
    const undercutGames = games.filter((g) => g.winner_id === p.id && g.is_undercut === 1);
    const totalPts = wonGames.reduce((sum, g) => sum + g.score_awarded, 0);
    const biggest = wonGames.reduce((max, g) => Math.max(max, g.score_awarded), 0);
    const leaguePoints = wonMatches.length * 3 + drawnMatches.length * 1;

    return {
      player_id: p.id,
      name: p.name,
      avatar_b64: p.avatar_b64,
      matches_played: playerMatches.length,
      matches_won: wonMatches.length,
      matches_drawn: drawnMatches.length,
      matches_lost: playerMatches.length - wonMatches.length - drawnMatches.length,
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
      league_points: leaguePoints,
    };
  });
}

export async function updateGameGin(
  db: D1Database,
  gameId: string,
  is_gin: number,
  gin_player_id: string | null
): Promise<void> {
  await db
    .prepare('UPDATE games SET is_gin = ?, gin_player_id = ? WHERE id = ?')
    .bind(is_gin, gin_player_id, gameId)
    .run();
}

export async function computeTeamStats(db: D1Database, month?: string): Promise<TeamStats[]> {
  const baseWhere = "completed_at IS NOT NULL AND team1_player2_id IS NOT NULL";
  const matchesResult = month
    ? await db.prepare(`SELECT * FROM matches WHERE ${baseWhere} AND strftime('%Y-%m', started_at) = ?`).bind(month).all<Match>()
    : await db.prepare(`SELECT * FROM matches WHERE ${baseWhere}`).all<Match>();

  const matches = matchesResult.results;
  const teamMap = new Map<string, TeamStats>();

  function ensure(name: string): TeamStats {
    if (!teamMap.has(name)) {
      teamMap.set(name, { team_name: name, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, league_points: 0 });
    }
    return teamMap.get(name)!;
  }

  for (const m of matches) {
    const t1Name = m.team1_name || 'Team A';
    const t2Name = m.team2_name || 'Team B';
    const t1 = ensure(t1Name);
    const t2 = ensure(t2Name);
    t1.matches_played++;
    t2.matches_played++;

    if (!m.winner_id) {
      t1.matches_drawn++; t2.matches_drawn++;
      t1.league_points++; t2.league_points++;
    } else if (m.winner_id === m.player1_id || m.winner_id === m.team1_player2_id) {
      t1.matches_won++; t2.matches_lost++;
      t1.league_points += 3;
    } else {
      t2.matches_won++; t1.matches_lost++;
      t2.league_points += 3;
    }
  }

  return Array.from(teamMap.values()).sort((a, b) => b.league_points - a.league_points);
}
