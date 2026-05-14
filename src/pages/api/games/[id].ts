export const prerender = false;
import type { APIRoute } from 'astro';
import { updateGameGin } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const { id } = params;
    if (!id) return new Response(JSON.stringify({ error: 'Game ID required' }), { status: 400 });
    const body = await request.json() as { is_gin?: number; gin_player_id?: string | null };
    await updateGameGin(db, id, body.is_gin ?? 0, body.gin_player_id ?? null);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
