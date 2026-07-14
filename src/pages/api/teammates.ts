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
    const rows = await db.prepare(`
      SELECT DISTINCT player1_id as a, team1_player2_id as b FROM matches WHERE team1_player2_id IS NOT NULL AND is_classic = 0
      UNION
      SELECT DISTINCT player2_id as a, team2_player2_id as b FROM matches WHERE team2_player2_id IS NOT NULL AND is_classic = 0
    `).all<{ a: string; b: string }>();
    return new Response(JSON.stringify(rows.results ?? []), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify([]), { status: 500 });
  }
};
