export const prerender = false;
import type { APIRoute } from 'astro';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);

    const [highestHand, mostDigu, highestMatchScore, mostMatches, biggestWin] = await Promise.all([
      // Highest single hand score
      db.prepare(`
        SELECT g.score_awarded, g.match_id,
          p.name as winner_name, p.nickname as winner_nick,
          m.started_at
        FROM games g
        JOIN matches m ON g.match_id = m.id
        JOIN players p ON p.id = g.winner_id
        ORDER BY g.score_awarded DESC LIMIT 1
      `).first<any>(),

      // Most digus in a single match
      db.prepare(`
        SELECT COUNT(*) as cnt, g.match_id, m.started_at,
          p.name as player_name, p.nickname as player_nick
        FROM games g
        JOIN matches m ON g.match_id = m.id
        JOIN players p ON p.id = g.gin_player_id
        WHERE g.gin_player_id IS NOT NULL
        GROUP BY g.match_id, g.gin_player_id
        ORDER BY cnt DESC LIMIT 1
      `).first<any>(),

      // Highest team score in a single match
      db.prepare(`
        SELECT SUM(g.score_awarded) as total, g.winner_id, m.started_at, m.id as match_id,
          p.name as winner_name, p.nickname as winner_nick
        FROM games g
        JOIN matches m ON g.match_id = m.id
        JOIN players p ON p.id = g.winner_id
        GROUP BY g.match_id, g.winner_id
        ORDER BY total DESC LIMIT 1
      `).first<any>(),

      // Most matches played
      db.prepare(`
        SELECT p.name, p.nickname, p.id,
          COUNT(DISTINCT m.id) as cnt
        FROM players p
        JOIN matches m ON m.player1_id = p.id OR m.player2_id = p.id
          OR m.team1_player2_id = p.id OR m.team2_player2_id = p.id
        WHERE m.completed_at IS NOT NULL
        GROUP BY p.id ORDER BY cnt DESC LIMIT 1
      `).first<any>(),

      // Biggest winning margin in a match
      db.prepare(`
        SELECT
          SUM(CASE WHEN g.winner_id = m.player1_id THEN g.score_awarded ELSE 0 END) as t1,
          SUM(CASE WHEN g.winner_id = m.player2_id THEN g.score_awarded ELSE 0 END) as t2,
          m.id as match_id, m.started_at,
          p1.name as p1_name, p1.nickname as p1_nick,
          p2.name as p2_name, p2.nickname as p2_nick,
          m.winner_id
        FROM matches m
        JOIN games g ON g.match_id = m.id
        JOIN players p1 ON p1.id = m.player1_id
        JOIN players p2 ON p2.id = m.player2_id
        WHERE m.completed_at IS NOT NULL
        GROUP BY m.id
        ORDER BY ABS(
          SUM(CASE WHEN g.winner_id = m.player1_id THEN g.score_awarded ELSE 0 END) -
          SUM(CASE WHEN g.winner_id = m.player2_id THEN g.score_awarded ELSE 0 END)
        ) DESC LIMIT 1
      `).first<any>(),
    ]);

    return new Response(JSON.stringify({
      highestHand,
      mostDigu,
      highestMatchScore,
      mostMatches,
      biggestWin,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
