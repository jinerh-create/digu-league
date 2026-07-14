export const prerender = false;
import type { APIRoute } from 'astro';
import { getPlayer, getPlayerMatches } from '../../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const id = params.id!;
    const [player, matches] = await Promise.all([
      getPlayer(db, id),
      getPlayerMatches(db, id),
    ]);
    if (!player) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

    const [scoreRow, ginRow, centuryRow, perfectRow] = await Promise.all([
      db.prepare(`
        SELECT COALESCE(SUM(g.score_awarded),0) AS total
        FROM games g
        JOIN matches m ON g.match_id = m.id
        WHERE m.is_classic = 0
          AND (m.player1_id = ?
           OR m.player2_id = ?
           OR m.team1_player2_id = ?
           OR m.team2_player2_id = ?)
      `).bind(id, id, id, id).first<{ total: number }>(),
      db.prepare('SELECT COUNT(*) AS cnt FROM games g JOIN matches m ON m.id = g.match_id WHERE g.gin_player_id = ? AND m.is_classic = 0').bind(id).first<{ cnt: number }>(),
      // Hands where player's team scored 100+ in a single round
      db.prepare(`
        SELECT COUNT(*) AS cnt FROM games g
        JOIN matches m ON g.match_id = m.id
        WHERE m.is_classic = 0 AND g.score_awarded >= 100
          AND (g.winner_id = ?
            OR (m.team1_player2_id = ? AND g.winner_id = m.player1_id)
            OR (m.team2_player2_id = ? AND g.winner_id = m.player2_id))
      `).bind(id, id, id).first<{ cnt: number }>(),
      // Matches where opponent scored 0 (perfect shutout)
      db.prepare(`
        SELECT COUNT(*) AS cnt FROM (
          SELECT m.id FROM matches m
          WHERE m.is_classic = 0 AND (m.player1_id = ? OR m.team1_player2_id = ?)
            AND m.winner_id = m.player1_id
            AND NOT EXISTS (
              SELECT 1 FROM games g WHERE g.match_id = m.id AND g.winner_id = m.player2_id
            )
          UNION ALL
          SELECT m.id FROM matches m
          WHERE m.is_classic = 0 AND (m.player2_id = ? OR m.team2_player2_id = ?)
            AND m.winner_id = m.player2_id
            AND NOT EXISTS (
              SELECT 1 FROM games g WHERE g.match_id = m.id AND g.winner_id = m.player1_id
            )
        )
      `).bind(id, id, id, id).first<{ cnt: number }>(),
    ]);

    // Calculate max win streak from match history
    let maxStreak = 0, curStreak = 0;
    for (const m of (matches as any[])) {
      const onTeam1 = m.player1_id === id || m.team1_player2_id === id;
      const won = onTeam1 ? m.winner_id === m.player1_id : m.winner_id === m.player2_id;
      if (won) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
      else curStreak = 0;
    }

    return new Response(JSON.stringify({
      player,
      matches,
      totalScore: scoreRow?.total ?? 0,
      ginCount: ginRow?.cnt ?? 0,
      centuryHands: centuryRow?.cnt ?? 0,
      perfectMatches: perfectRow?.cnt ?? 0,
      maxWinStreak: maxStreak,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
