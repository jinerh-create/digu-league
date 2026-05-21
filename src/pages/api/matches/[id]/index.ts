export const prerender = false;
import type { APIRoute } from 'astro';
import { getMatch, getGames, updateMatchDate, deleteMatch, updateMatchComment } from '../../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    await deleteMatch(db, params.id!);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as { started_at?: string; comment?: string | null };
    if (body.started_at) await updateMatchDate(db, params.id!, body.started_at);
    if ('comment' in body) await updateMatchComment(db, params.id!, body.comment ?? null);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const match = await getMatch(db, params.id!);
    if (!match) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    const games = await getGames(db, params.id!);
    return new Response(JSON.stringify({ ...match, games }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
