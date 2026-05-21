export const prerender = false;
import type { APIRoute } from 'astro';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const p1 = url.searchParams.get('p1');
    const p2 = url.searchParams.get('p2');
    if (!p1 || !p2) return new Response(JSON.stringify({ error: 'p1 and p2 required' }), { status: 400 });

    const [p1Info, p2Info] = await Promise.all([
      db.prepare('SELECT id, name, nickname, avatar_b64 FROM players WHERE id = ?').bind(p1).first<any>(),
      db.prepare('SELECT id, name, nickname, avatar_b64 FROM players WHERE id = ?').bind(p2).first<any>(),
    ]);
    if (!p1Info || !p2Info) return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404 });

    // Matches between these two players (any combination of positions)
    const matches = await db.prepare(`
      SELECT m.*,
        SUM(CASE WHEN g.winner_id = m.player1_id THEN g.score_awarded ELSE 0 END) as t1_score,
        SUM(CASE WHEN g.winner_id = m.player2_id THEN g.score_awarded ELSE 0 END) as t2_score,
        COUNT(g.id) as rounds
      FROM matches m
      JOIN games g ON g.match_id = m.id
      WHERE m.completed_at IS NOT NULL
        AND (
          (m.player1_id IN (?,?) AND m.player2_id IN (?,?))
          OR (m.team1_player2_id IN (?,?) AND (m.player1_id IN (?,?) OR m.player2_id IN (?,?)))
          OR (m.team2_player2_id IN (?,?) AND (m.player1_id IN (?,?) OR m.player2_id IN (?,?)))
        )
      GROUP BY m.id
      ORDER BY m.started_at DESC
    `).bind(p1,p2,p1,p2, p1,p2,p1,p2,p1,p2, p1,p2,p1,p2,p1,p2).all<any>();

    const rows = matches.results ?? [];
    let p1Wins = 0, p2Wins = 0, p1TotalScore = 0, p2TotalScore = 0;

    for (const m of rows) {
      const p1OnTeam1 = m.player1_id === p1 || m.team1_player2_id === p1;
      const p1Score = p1OnTeam1 ? m.t1_score : m.t2_score;
      const p2Score = p1OnTeam1 ? m.t2_score : m.t1_score;
      p1TotalScore += p1Score;
      p2TotalScore += p2Score;
      if (m.winner_id) {
        const p1Won = (p1OnTeam1 && m.winner_id === m.player1_id) || (!p1OnTeam1 && m.winner_id === m.player2_id);
        if (p1Won) p1Wins++; else p2Wins++;
      }
    }

    return new Response(JSON.stringify({
      p1: p1Info, p2: p2Info,
      matches: rows,
      p1Wins, p2Wins,
      draws: rows.length - p1Wins - p2Wins,
      p1AvgScore: rows.length ? Math.round(p1TotalScore / rows.length) : 0,
      p2AvgScore: rows.length ? Math.round(p2TotalScore / rows.length) : 0,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
