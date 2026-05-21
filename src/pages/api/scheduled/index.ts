export const prerender = false;
import type { APIRoute } from 'astro';
import { getScheduledMatches, createScheduledMatch } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const scheduled = await getScheduledMatches(db);
    return new Response(JSON.stringify(scheduled), { headers: { 'Content-Type': 'application/json' } });
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
      team1_player2_id?: string;
      team2_player2_id?: string;
      team1_name?: string;
      team2_name?: string;
      scheduled_at?: string;
      note?: string;
    };
    if (!body.player1_id || !body.player2_id) {
      return new Response(JSON.stringify({ error: 'Both players required' }), { status: 400 });
    }
    if (!body.scheduled_at) {
      return new Response(JSON.stringify({ error: 'scheduled_at required' }), { status: 400 });
    }
    const id = crypto.randomUUID();
    await createScheduledMatch(db, {
      id,
      player1_id: body.player1_id,
      player2_id: body.player2_id,
      team1_player2_id: body.team1_player2_id || null,
      team2_player2_id: body.team2_player2_id || null,
      team1_name: body.team1_name || null,
      team2_name: body.team2_name || null,
      scheduled_at: body.scheduled_at,
      note: body.note || null,
      created_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: true, id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
