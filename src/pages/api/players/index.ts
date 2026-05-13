import type { APIRoute } from 'astro';
import { getActivePlayers, createPlayer } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const players = await getActivePlayers(db);
    return new Response(JSON.stringify(players), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as { name?: string };
    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: 'Name required' }), { status: 400 });
    }
    const id = crypto.randomUUID();
    const joined_at = new Date().toISOString();
    await createPlayer(db, id, body.name.trim(), joined_at);
    return new Response(JSON.stringify({ id, name: body.name.trim(), joined_at, active: 1, avatar_b64: null }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
