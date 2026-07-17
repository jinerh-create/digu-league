import type { Player, Match, Game, PlayerStats, TeamStats, Season, MatchReaction, ScheduledMatch } from './types';

export async function getPlayers(db: D1Database): Promise<Player[]> {
  const result = await db
    .prepare('SELECT * FROM players WHERE is_guest = 0 ORDER BY joined_at ASC')
    .all<Player>();
  return result.results;
}

export async function getActivePlayers(db: D1Database): Promise<Player[]> {
  const result = await db
    .prepare('SELECT * FROM players WHERE active = 1 AND is_guest = 0 ORDER BY name ASC')
    .all<Player>();
  return result.results;
}

// Guest player created for a one-off classic match (kept out of the league).
export async function createGuestPlayer(
  db: D1Database,
  id: string,
  name: string,
  joined_at: string
): Promise<void> {
  await db
    .prepare('INSERT INTO players (id, name, joined_at, active, is_guest) VALUES (?, ?, ?, 0, 1)')
    .bind(id, name, joined_at)
    .run();
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

export async function updatePlayerNickname(
  db: D1Database,
  id: string,
  nickname: string | null
): Promise<void> {
  await db.prepare('UPDATE players SET nickname = ? WHERE id = ?').bind(nickname, id).run();
}

export async function updatePlayerActive(
  db: D1Database,
  id: string,
  active: number
): Promise<void> {
  await db.prepare('UPDATE players SET active = ? WHERE id = ?').bind(active, id).run();
}

export async function getTotalMatchCount(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM matches WHERE completed_at IS NOT NULL AND is_classic = 0').first<{ n: number }>();
  return r?.n ?? 0;
}

export async function getTotalGamesCount(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM games g JOIN matches m ON m.id = g.match_id WHERE m.is_classic = 0').first<{ n: number }>();
  return r?.n ?? 0;
}

export async function getMatches(db: D1Database, limit = 50): Promise<Match[]> {
  const result = await db
    .prepare(
      `SELECT m.*,
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar, p1.nickname AS player1_nickname,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar, p2.nickname AS player2_nickname,
        pw.name AS winner_name,
        p3.name AS team1_player2_name, p3.nickname AS team1_player2_nickname,
        p4.name AS team2_player2_name, p4.nickname AS team2_player2_nickname
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       LEFT JOIN players p3 ON p3.id = m.team1_player2_id
       LEFT JOIN players p4 ON p4.id = m.team2_player2_id
       WHERE m.is_classic = 0
       ORDER BY m.started_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Match>();
  return result.results;
}

// Classic (casual) matches only — separate history, never in the league.
export async function getClassicMatches(db: D1Database, limit = 100): Promise<Match[]> {
  const result = await db
    .prepare(
      `SELECT m.*,
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar, p1.nickname AS player1_nickname,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar, p2.nickname AS player2_nickname,
        pw.name AS winner_name,
        p3.name AS team1_player2_name, p3.nickname AS team1_player2_nickname,
        p4.name AS team2_player2_name, p4.nickname AS team2_player2_nickname
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       LEFT JOIN players p3 ON p3.id = m.team1_player2_id
       LEFT JOIN players p4 ON p4.id = m.team2_player2_id
       WHERE m.is_classic = 1
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
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar, p1.nickname AS player1_nickname,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar, p2.nickname AS player2_nickname,
        pw.name AS winner_name,
        p3.name AS team1_player2_name, p3.nickname AS team1_player2_nickname,
        p4.name AS team2_player2_name, p4.nickname AS team2_player2_nickname
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
        p1.name AS player1_name, p1.avatar_b64 AS player1_avatar, p1.nickname AS player1_nickname,
        p2.name AS player2_name, p2.avatar_b64 AS player2_avatar, p2.nickname AS player2_nickname,
        p3.name AS team1_player2_name, p3.nickname AS team1_player2_nickname,
        p4.name AS team2_player2_name, p4.nickname AS team2_player2_nickname
       FROM matches m
       JOIN players p1 ON p1.id = m.player1_id
       JOIN players p2 ON p2.id = m.player2_id
       LEFT JOIN players p3 ON p3.id = m.team1_player2_id
       LEFT JOIN players p4 ON p4.id = m.team2_player2_id
       WHERE m.completed_at IS NULL AND m.is_classic = 0
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
  max_rounds?: number,
  season_id?: string | null,
  is_classic?: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO matches
        (id, player1_id, player2_id, target_score, started_at,
         team1_name, team2_name, team1_player2_id, team2_player2_id, max_rounds, season_id, is_classic)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id, player1_id, player2_id, target_score, started_at,
      team1_name ?? null, team2_name ?? null,
      team1_player2_id ?? null, team2_player2_id ?? null,
      max_rounds ?? 0, season_id ?? null, is_classic ?? 0
    )
    .run();
}

export async function updateMatchDate(
  db: D1Database,
  id: string,
  started_at: string
): Promise<void> {
  await db.prepare('UPDATE matches SET started_at = ? WHERE id = ?').bind(started_at, id).run();
}

export async function deleteMatch(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM games WHERE match_id = ?').bind(id).run();
  await db.prepare('DELETE FROM matches WHERE id = ?').bind(id).run();
}

export async function updateMatchComment(db: D1Database, id: string, comment: string | null): Promise<void> {
  await db.prepare('UPDATE matches SET comment = ? WHERE id = ?').bind(comment || null, id).run();
}

export async function getSeasons(db: D1Database): Promise<Season[]> {
  const result = await db.prepare('SELECT * FROM seasons ORDER BY started_at DESC').all<Season>();
  return result.results;
}

export async function createSeason(db: D1Database, id: string, name: string, started_at: string): Promise<void> {
  await db.prepare('INSERT INTO seasons (id, name, started_at) VALUES (?, ?, ?)').bind(id, name, started_at).run();
  // Archive all current completed matches into this season
  await db.prepare('UPDATE matches SET season_id = ? WHERE season_id IS NULL AND completed_at IS NOT NULL').bind(id).run();
}

export async function getPlayerMatches(db: D1Database, playerId: string): Promise<Match[]> {
  const result = await db.prepare(
    `SELECT m.*,
      p1.name AS player1_name, p1.avatar_b64 AS player1_avatar, p1.nickname AS player1_nickname,
      p2.name AS player2_name, p2.avatar_b64 AS player2_avatar, p2.nickname AS player2_nickname,
      pw.name AS winner_name,
      p3.name AS team1_player2_name, p3.nickname AS team1_player2_nickname,
      p4.name AS team2_player2_name, p4.nickname AS team2_player2_nickname
     FROM matches m
     JOIN players p1 ON p1.id = m.player1_id
     JOIN players p2 ON p2.id = m.player2_id
     LEFT JOIN players pw ON pw.id = m.winner_id
     LEFT JOIN players p3 ON p3.id = m.team1_player2_id
     LEFT JOIN players p4 ON p4.id = m.team2_player2_id
     WHERE m.completed_at IS NOT NULL AND m.is_classic = 0
       AND (m.player1_id = ? OR m.player2_id = ? OR m.team1_player2_id = ? OR m.team2_player2_id = ?)
     ORDER BY m.started_at DESC`
  ).bind(playerId, playerId, playerId, playerId).all<Match>();
  return result.results;
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

export async function getGame(db: D1Database, id: string): Promise<Game | null> {
  return db.prepare('SELECT * FROM games WHERE id = ?').bind(id).first<Game>();
}

export async function deleteGame(db: D1Database, id: string): Promise<void> {
  const game = await getGame(db, id);
  if (!game) return;
  await db.prepare('DELETE FROM games WHERE id = ?').bind(id).run();
  // Renumber remaining rounds in one query instead of one per row
  await db.prepare(`
    UPDATE games SET round_number = (
      SELECT COUNT(*) FROM games g2
      WHERE g2.match_id = games.match_id AND g2.timestamp <= games.timestamp
    )
    WHERE match_id = ?
  `).bind(game.match_id).run();
}

export async function computePlayerStats(db: D1Database, month?: string, matchType?: 'single' | 'team', season?: string): Promise<PlayerStats[]> {
  const players = await getActivePlayers(db);

  // Build WHERE clause with parameterized bindings (no string interpolation for user values)
  const conditions: string[] = ['completed_at IS NOT NULL', 'is_classic = 0'];
  const bindings: (string | number)[] = [];
  if (matchType === 'single') conditions.push('team1_player2_id IS NULL');
  else if (matchType === 'team') conditions.push('team1_player2_id IS NOT NULL');
  if (season === 'current') conditions.push('season_id IS NULL');
  else if (season) { conditions.push('season_id = ?'); bindings.push(season); }
  if (month) { conditions.push("strftime('%Y-%m', started_at) = ?"); bindings.push(month); }

  const whereClause = conditions.join(' AND ');
  const matchStmt = db.prepare(`SELECT * FROM matches WHERE ${whereClause}`);
  const matchesResult = bindings.length > 0
    ? await matchStmt.bind(...bindings).all<Match>()
    : await matchStmt.all<Match>();

  const matches = matchesResult.results;
  if (matches.length === 0) {
    return players.map(p => ({
      player_id: p.id, name: p.name, nickname: p.nickname, avatar_b64: p.avatar_b64,
      matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0,
      games_played: 0, games_won: 0, total_points_scored: 0, gin_count: 0,
      undercut_count: 0, biggest_hand: 0, avg_points_per_game: 0, win_rate: 0, league_points: 0,
    }));
  }

  const matchIds = matches.map(m => m.id);
  const gamesResult = await db
    .prepare(`SELECT * FROM games WHERE match_id IN (${matchIds.map(() => '?').join(',')})`)
    .bind(...matchIds).all<Game>();
  const games = gamesResult.results;

  // ── Single-pass O(M) match stats accumulator ──────────────────────────────
  type MS = { played: number; won: number; drawn: number };
  const matchStats = new Map<string, MS>();
  const ensure = (id: string): MS => {
    if (!matchStats.has(id)) matchStats.set(id, { played: 0, won: 0, drawn: 0 });
    return matchStats.get(id)!;
  };

  const matchById = new Map<string, Match>();
  for (const m of matches) {
    matchById.set(m.id, m);
    const team1Won = m.winner_id ? m.winner_id === m.player1_id : null;
    const applyMatch = (pid: string, onTeam1: boolean) => {
      const s = ensure(pid);
      s.played++;
      if (team1Won === null) { s.drawn++; }
      else if ((onTeam1 && team1Won) || (!onTeam1 && !team1Won)) { s.won++; }
    };
    applyMatch(m.player1_id, true);
    applyMatch(m.player2_id, false);
    if (m.team1_player2_id) applyMatch(m.team1_player2_id, true);
    if (m.team2_player2_id) applyMatch(m.team2_player2_id, false);
  }

  // ── Single-pass O(G) game stats accumulator ───────────────────────────────
  type GS = { played: number; won: number; totalPts: number; biggest: number; gins: number; undercuts: number };
  const gameStats = new Map<string, GS>();
  const ensureG = (id: string): GS => {
    if (!gameStats.has(id)) gameStats.set(id, { played: 0, won: 0, totalPts: 0, biggest: 0, gins: 0, undercuts: 0 });
    return gameStats.get(id)!;
  };

  for (const g of games) {
    const m = matchById.get(g.match_id);
    if (!m) continue;

    // Every participant gets games_played++
    for (const pid of [m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id]) {
      if (pid) ensureG(pid).played++;
    }

    // Credit the winning team (both members for team matches)
    const team1WonGame = g.winner_id === m.player1_id;
    const winnerIds = team1WonGame
      ? [m.player1_id, m.team1_player2_id].filter(Boolean) as string[]
      : [m.player2_id, m.team2_player2_id].filter(Boolean) as string[];
    for (const pid of winnerIds) {
      const gs = ensureG(pid);
      gs.won++;
      gs.totalPts += g.score_awarded;
      if (g.score_awarded > gs.biggest) gs.biggest = g.score_awarded;
    }

    // Gin: only the player who personally ginned
    if (g.is_gin === 1) {
      const ginner = g.gin_player_id ?? g.winner_id;
      ensureG(ginner).gins++;
    }

    // Undercut: only the game winner
    if (g.is_undercut === 1) ensureG(g.winner_id).undercuts++;
  }

  // ── Assemble final stats per player (O(P) simple Map lookup) ─────────────
  return players.map(p => {
    const ms = matchStats.get(p.id) ?? { played: 0, won: 0, drawn: 0 };
    const gs = gameStats.get(p.id) ?? { played: 0, won: 0, totalPts: 0, biggest: 0, gins: 0, undercuts: 0 };
    return {
      player_id: p.id,
      name: p.name,
      nickname: p.nickname,
      avatar_b64: p.avatar_b64,
      matches_played: ms.played,
      matches_won: ms.won,
      matches_drawn: ms.drawn,
      matches_lost: ms.played - ms.won - ms.drawn,
      games_played: gs.played,
      games_won: gs.won,
      total_points_scored: gs.totalPts,
      gin_count: gs.gins,
      undercut_count: gs.undercuts,
      biggest_hand: gs.biggest,
      avg_points_per_game: gs.won > 0 ? Math.round(gs.totalPts / gs.won) : 0,
      win_rate: ms.played > 0 ? Math.round((ms.won / ms.played) * 1000) / 10 : 0,
      league_points: ms.won * 3 + ms.drawn,
    };
  });
}

export async function updateGame(
  db: D1Database,
  gameId: string,
  winner_id: string,
  loser_id: string,
  score_awarded: number,
  is_gin: number,
  gin_player_id: string | null,
  t1_p1_cards?: number | null,
  t1_p2_cards?: number | null,
  t2_p1_cards?: number | null,
  t2_p2_cards?: number | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE games SET winner_id = ?, loser_id = ?, knocker_id = ?, score_awarded = ?,
       is_gin = ?, gin_player_id = ?,
       t1_p1_cards = ?, t1_p2_cards = ?, t2_p1_cards = ?, t2_p2_cards = ?
       WHERE id = ?`
    )
    .bind(
      winner_id, loser_id, winner_id, score_awarded,
      is_gin, gin_player_id,
      t1_p1_cards ?? null, t1_p2_cards ?? null, t2_p1_cards ?? null, t2_p2_cards ?? null,
      gameId
    )
    .run();
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

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function getReactions(db: D1Database, matchId: string): Promise<MatchReaction[]> {
  const r = await db.prepare('SELECT * FROM match_reactions WHERE match_id = ? ORDER BY created_at ASC').bind(matchId).all<MatchReaction>();
  return r.results;
}

export async function addReaction(db: D1Database, id: string, matchId: string, emoji: string, createdAt: string): Promise<void> {
  await db.prepare('INSERT INTO match_reactions (id, match_id, emoji, created_at) VALUES (?, ?, ?, ?)').bind(id, matchId, emoji, createdAt).run();
}

export async function removeReaction(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM match_reactions WHERE id = ?').bind(id).run();
}

// ─── Scheduled Matches ────────────────────────────────────────────────────────

export async function getScheduledMatches(db: D1Database): Promise<ScheduledMatch[]> {
  const r = await db.prepare(
    `SELECT s.*,
      p1.name AS player1_name, p1.nickname AS player1_nickname,
      p2.name AS player2_name, p2.nickname AS player2_nickname,
      p3.name AS team1_player2_name, p3.nickname AS team1_player2_nickname,
      p4.name AS team2_player2_name, p4.nickname AS team2_player2_nickname
     FROM scheduled_matches s
     JOIN players p1 ON p1.id = s.player1_id
     JOIN players p2 ON p2.id = s.player2_id
     LEFT JOIN players p3 ON p3.id = s.team1_player2_id
     LEFT JOIN players p4 ON p4.id = s.team2_player2_id
     WHERE s.scheduled_at >= datetime('now', '-1 day')
     ORDER BY s.scheduled_at ASC`
  ).all<ScheduledMatch>();
  return r.results;
}

export async function createScheduledMatch(db: D1Database, m: {
  id: string; player1_id: string; player2_id: string;
  team1_player2_id?: string | null; team2_player2_id?: string | null;
  team1_name?: string | null; team2_name?: string | null;
  scheduled_at: string; note?: string | null; created_at: string;
}): Promise<void> {
  await db.prepare(
    `INSERT INTO scheduled_matches (id, player1_id, player2_id, team1_player2_id, team2_player2_id, team1_name, team2_name, scheduled_at, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(m.id, m.player1_id, m.player2_id, m.team1_player2_id ?? null, m.team2_player2_id ?? null,
    m.team1_name ?? null, m.team2_name ?? null, m.scheduled_at, m.note ?? null, m.created_at).run();
}

export async function deleteScheduledMatch(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM scheduled_matches WHERE id = ?').bind(id).run();
}

export async function computeTeamStats(db: D1Database, month?: string): Promise<TeamStats[]> {
  const baseWhere = "completed_at IS NOT NULL AND team1_player2_id IS NOT NULL AND is_classic = 0";
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

export const OC_SEASON_ID = 'oc-champions-league';

export interface OCPlayerStanding {
  player_id: string;
  name: string;
  nickname: string | null;
  avatar_b64: string | null;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  champions_points: number; // win +3 / draw +1 / loss −1
}

export interface OCChampionsResult {
  month: string;     // 'YYYY-MM' — the ongoing month whose scores are shown
  qualMonth: string; // 'YYYY-MM' — last month, whose league top-5 qualified
  qualifiers: { player_id: string; name: string; nickname: string | null; avatar_b64: string | null; league_points: number; rank: number }[];
  standings: OCPlayerStanding[];
  started: boolean;
}

/**
 * OC Champions League — INDIVIDUAL players, MONTHLY.
 * Every month is a fresh tournament. The 5 players who finished in the top-5 of
 * LAST month's current league qualify; their scores in the ONGOING month are then
 * re-scored with loss = −1 (league is win +3 / draw +1 / loss 0). Same monthly
 * matches that count in the league — they count here too. Defaults to the ongoing month.
 */
export async function computeOCChampions(db: D1Database, month?: string): Promise<OCChampionsResult> {
  const monthKey = month || new Date().toISOString().slice(0, 7); // ongoing month (scores shown)

  // Qualification = LAST month's league top-5.
  let [qy, qm] = monthKey.split('-').map(Number);
  qm -= 1; if (qm === 0) { qm = 12; qy -= 1; }
  const qualMonth = `${qy}-${String(qm).padStart(2, '0')}`;

  // Top-5 players by league points in LAST month's league standings.
  const lastMonth = await computePlayerStats(db, qualMonth);
  const leagueSorted = [...lastMonth].sort((a, b) =>
    b.league_points - a.league_points ||
    b.win_rate - a.win_rate ||
    b.total_points_scored - a.total_points_scored
  );
  const top5 = leagueSorted.slice(0, 5);
  const qualifiers = top5.map((p, i) => ({
    player_id: p.player_id, name: p.name, nickname: p.nickname, avatar_b64: p.avatar_b64,
    league_points: p.league_points, rank: i + 1,
  }));

  // Their standings in the ONGOING month, re-scored with loss −1.
  const thisMonth = await computePlayerStats(db, monthKey);
  const byId = new Map(thisMonth.map(p => [p.player_id, p]));
  const standings: OCPlayerStanding[] = top5.map(q => {
    const p = byId.get(q.player_id);
    const won = p?.matches_won ?? 0, drawn = p?.matches_drawn ?? 0, lost = p?.matches_lost ?? 0;
    return {
      player_id: q.player_id, name: q.name, nickname: q.nickname, avatar_b64: q.avatar_b64,
      matches_played: p?.matches_played ?? 0, matches_won: won, matches_drawn: drawn, matches_lost: lost,
      champions_points: won * 3 + drawn - lost,
    };
  }).sort((a, b) =>
    b.champions_points - a.champions_points ||
    b.matches_won - a.matches_won ||
    a.matches_lost - b.matches_lost
  );

  const started = standings.some(s => s.matches_played > 0);
  return { month: monthKey, qualMonth, qualifiers, standings, started };
}

/* ── Form chart + streaks ──────────────────────────────────────────────────────
   One cumulative line per player: +1 on a win, -1 on a loss, flat on a draw.

   Two traps worth remembering (both cost real bugs elsewhere in this app):
   1. `winner_id` is a SIDE marker, not a player. In a 2v2 the winner is always
      recorded as player1_id or player2_id — never the partner. So a win is
      `onTeam1 ? winner_id === player1_id : winner_id === player2_id`. Matching
      `winner_id === playerId` silently undercounts every partner's team wins.
   2. `is_classic = 1` matches are casual and excluded from every league stat.
   A completed match with winner_id NULL is a draw. */

export interface FormPoint { i: number; v: number; at: string; r: 'W' | 'L' | 'D'; }
export interface PlayerForm {
  id: string; name: string; points: FormPoint[];
  played: number; won: number; lost: number; drawn: number; final: number;
  bestWin: number; worstLoss: number; current: number; currentType: 'W' | 'L' | null;
}

export async function getPlayerForm(
  db: D1Database,
  maxPlayers = 12,
  opts: { activeOnly?: boolean; minPlayed?: number } = {},
): Promise<{ series: PlayerForm[]; matches: number }> {
  const { activeOnly = true, minPlayed = 1 } = opts;
  /* Which players may appear as a line. Matches still count in full — an active
     player's win over a since-retired one is real — we just don't draw a line
     for inactive players or one-off guests. */
  const eligible = activeOnly
    ? new Set(
        (await db.prepare(`SELECT id FROM players WHERE active = 1 AND COALESCE(is_guest, 0) = 0`).all<{ id: string }>())
          .results.map(r => r.id),
      )
    : null;

  const res = await db
    .prepare(
      `SELECT m.id, m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id,
              m.winner_id, m.started_at,
              p1.name AS p1n, p1.nickname AS p1k,
              p2.name AS p2n, p2.nickname AS p2k,
              p3.name AS p3n, p3.nickname AS p3k,
              p4.name AS p4n, p4.nickname AS p4k
         FROM matches m
         JOIN players p1 ON p1.id = m.player1_id
         JOIN players p2 ON p2.id = m.player2_id
         LEFT JOIN players p3 ON p3.id = m.team1_player2_id
         LEFT JOIN players p4 ON p4.id = m.team2_player2_id
        WHERE m.is_classic = 0 AND m.completed_at IS NOT NULL
        ORDER BY m.started_at ASC`
    )
    .all<any>();

  const rows = res.results || [];
  const nickOf = (n: string | null, k: string | null) => k || (n ?? '').split(' ')[0] || (n ?? '');
  const acc = new Map<string, PlayerForm>();
  const touch = (id: string | null, name: string) => {
    if (!id) return null;
    let p = acc.get(id);
    if (!p) {
      p = { id, name, points: [], played: 0, won: 0, lost: 0, drawn: 0, final: 0,
            bestWin: 0, worstLoss: 0, current: 0, currentType: null };
      acc.set(id, p);
    }
    return p;
  };

  rows.forEach((m, idx) => {
    const t1 = [touch(m.player1_id, nickOf(m.p1n, m.p1k)), touch(m.team1_player2_id, nickOf(m.p3n, m.p3k))];
    const t2 = [touch(m.player2_id, nickOf(m.p2n, m.p2k)), touch(m.team2_player2_id, nickOf(m.p4n, m.p4k))];
    const draw = !m.winner_id;
    const t1Won = !draw && m.winner_id === m.player1_id;

    const apply = (p: PlayerForm | null, won: boolean) => {
      if (!p) return;
      const r: FormPoint['r'] = draw ? 'D' : won ? 'W' : 'L';
      p.played++;
      if (r === 'W') { p.won++; p.final++; }
      else if (r === 'L') { p.lost++; p.final--; }
      else p.drawn++;

      // streaks — a draw breaks both, matching the Streak Emperor badge rule
      if (r === 'W') {
        p.current = p.currentType === 'W' ? p.current + 1 : 1;
        p.currentType = 'W';
        p.bestWin = Math.max(p.bestWin, p.current);
      } else if (r === 'L') {
        p.current = p.currentType === 'L' ? p.current + 1 : 1;
        p.currentType = 'L';
        p.worstLoss = Math.max(p.worstLoss, p.current);
      } else { p.current = 0; p.currentType = null; }

      p.points.push({ i: idx + 1, v: p.final, at: m.started_at, r });
    };
    t1.forEach(p => apply(p, t1Won));
    t2.forEach(p => apply(p, !draw && !t1Won));
  });

  const series = [...acc.values()]
    .filter(p => p.played >= minPlayed && (!eligible || eligible.has(p.id)))
    .sort((a, b) => b.final - a.final || b.played - a.played)
    .slice(0, maxPlayers);

  return { series, matches: rows.length };
}

/* ── Verification ─────────────────────────────────────────────────────────────
   Existing players are grandfathered verified (migration 0013). New players
   start unverified and request verification; an admin approves. */
export async function requestVerification(db: D1Database, playerId: string): Promise<void> {
  await db.prepare('UPDATE players SET verify_requested = 1 WHERE id = ? AND verified = 0').bind(playerId).run();
}
export async function setVerified(db: D1Database, playerId: string, verified: boolean): Promise<void> {
  await db.prepare('UPDATE players SET verified = ?, verify_requested = 0 WHERE id = ?')
    .bind(verified ? 1 : 0, playerId).run();
}
export async function getVerificationRequests(db: D1Database) {
  const res = await db.prepare(
    'SELECT id, name, nickname, joined_at FROM players WHERE verify_requested = 1 AND verified = 0 ORDER BY joined_at ASC',
  ).all();
  return res.results;
}
