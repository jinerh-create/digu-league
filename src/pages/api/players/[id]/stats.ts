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

    // Biggest victory / defeat — largest score margin in a won / lost league match.
    // Per-match side totals via conditional sums over games (winner-of-round gets
    // the points), then pick the max margin among wins and among losses.
    const marginRows = await db.prepare(`
      SELECT m.id, m.winner_id, m.player1_id, m.player2_id, m.team1_player2_id, m.team2_player2_id, m.started_at,
             p1.name AS p1n, p1.nickname AS p1k, p2.name AS p2n, p2.nickname AS p2k,
             p3.name AS p3n, p3.nickname AS p3k, p4.name AS p4n, p4.nickname AS p4k,
             SUM(CASE WHEN g.winner_id = m.player1_id OR g.winner_id = m.team1_player2_id THEN g.score_awarded ELSE 0 END) AS t1,
             SUM(CASE WHEN g.winner_id = m.player2_id OR g.winner_id = m.team2_player2_id THEN g.score_awarded ELSE 0 END) AS t2,
             SUM(COALESCE(g.t1_p1_cards,0) + COALESCE(g.t1_p2_cards,0)) AS c1,
             SUM(COALESCE(g.t2_p1_cards,0) + COALESCE(g.t2_p2_cards,0)) AS c2
        FROM matches m
        JOIN games g ON g.match_id = m.id
        LEFT JOIN players p1 ON p1.id = m.player1_id
        LEFT JOIN players p2 ON p2.id = m.player2_id
        LEFT JOIN players p3 ON p3.id = m.team1_player2_id
        LEFT JOIN players p4 ON p4.id = m.team2_player2_id
       WHERE m.is_classic = 0 AND m.completed_at IS NOT NULL AND m.winner_id IS NOT NULL
         AND (m.player1_id = ? OR m.player2_id = ? OR m.team1_player2_id = ? OR m.team2_player2_id = ?)
       GROUP BY m.id
    `).bind(id, id, id, id).all<any>();

    const nk = (n: string | null, k: string | null) => k || (n || '').split(' ')[0] || n || '';
    let biggestVictory: any = null, biggestDefeat: any = null;
    for (const r of (marginRows.results || [])) {
      const onTeam1 = r.player1_id === id || r.team1_player2_id === id;
      const won = onTeam1 ? r.winner_id === r.player1_id : r.winner_id === r.player2_id;
      // Mirror the scoresheet: team matches display card totals, 1v1 displays points.
      // Older team matches predate card tracking (cards all 0) — fall back to points.
      const isTeam = !!r.team1_player2_id && (r.c1 > 0 || r.c2 > 0);
      const s1 = isTeam ? r.c1 : r.t1, s2 = isTeam ? r.c2 : r.t2;
      const mine = onTeam1 ? s1 : s2, opp = onTeam1 ? s2 : s1;
      const margin = mine - opp;
      const oppLabel = onTeam1
        ? nk(r.p2n, r.p2k) + (r.team2_player2_id ? ' / ' + nk(r.p4n, r.p4k) : '')
        : nk(r.p1n, r.p1k) + (r.team1_player2_id ? ' / ' + nk(r.p3n, r.p3k) : '');
      const rec = { margin: Math.abs(margin), myScore: mine, oppScore: opp, opponent: oppLabel, date: r.started_at, matchId: r.id };
      if (won) { if (!biggestVictory || rec.margin > biggestVictory.margin) biggestVictory = rec; }
      else { if (!biggestDefeat || rec.margin > biggestDefeat.margin) biggestDefeat = rec; }
    }

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
      biggestVictory,
      biggestDefeat,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
