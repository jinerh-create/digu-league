export const prerender = false;
import type { APIRoute } from 'astro';
import { getSeasons, createSeason } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const seasons = await getSeasons(db);
    return new Response(JSON.stringify(seasons), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as { name: string };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await createSeason(db, id, body.name || `Season ${new Date().getFullYear()}`, now);
    return new Response(JSON.stringify({ ok: true, id }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
