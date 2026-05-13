import type { APIRoute } from 'astro';
import { getMatches, createMatch } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const matches = await getMatches(db);
    return new Response(JSON.stringify(matches), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as {
      player1_id?: string;
      player2_id?: string;
      target_score?: number;
      team1_name?: string;
      team2_name?: string;
      team1_player2_id?: string;
      team2_player2_id?: string;
    };

    if (!body.player1_id || !body.player2_id) {
      return new Response(JSON.stringify({ error: 'Both players required' }), { status: 400 });
    }
    if (body.player1_id === body.player2_id) {
      return new Response(JSON.stringify({ error: 'Players must be different' }), { status: 400 });
    }
    const targetScore = body.target_score ?? 100;
    if (![100, 500].includes(targetScore) && (targetScore < 10 || targetScore > 10000)) {
      return new Response(JSON.stringify({ error: 'Invalid target score' }), { status: 400 });
    }

    const id = crypto.randomUUID();
    const started_at = new Date().toISOString();
    await createMatch(
      db, id, body.player1_id, body.player2_id, targetScore, started_at,
      body.team1_name, body.team2_name, body.team1_player2_id, body.team2_player2_id
    );

    return new Response(
      JSON.stringify({ id, player1_id: body.player1_id, player2_id: body.player2_id, target_score: targetScore, started_at, winner_id: null, completed_at: null }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
