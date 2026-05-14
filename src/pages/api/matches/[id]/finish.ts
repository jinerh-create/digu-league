export const prerender = false;
import type { APIRoute } from 'astro';
import { getMatch, getGames, completeMatch } from '../../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const match = await getMatch(db, params.id!);
    if (!match) return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });
    if (match.completed_at) return new Response(JSON.stringify({ error: 'Match already completed' }), { status: 400 });

    const games = await getGames(db, params.id!);
    const p1Score = games.filter(g => g.winner_id === match.player1_id).reduce((s, g) => s + g.score_awarded, 0);
    const p2Score = games.filter(g => g.winner_id === match.player2_id).reduce((s, g) => s + g.score_awarded, 0);

    // null winner_id = draw
    let winnerId: string | null = null;
    if (p1Score > p2Score) winnerId = match.player1_id;
    else if (p2Score > p1Score) winnerId = match.player2_id;
    // if equal: draw, winnerId stays null

    await completeMatch(db, params.id!, winnerId!, new Date().toISOString());

    return new Response(
      JSON.stringify({ ok: true, winnerId, p1Score, p2Score, isDraw: winnerId === null }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
