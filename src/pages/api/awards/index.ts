export const prerender = false;
import type { APIRoute } from 'astro';
import { AWARD_DEFS, getAwards, setAward, removeAward, computeSuggestions } from '../../../lib/awards';

/* Middleware already gates this: GET = any signed-in user; POST/DELETE fall into
   the "everything else: admin only" branch — awards stay manually admin-assigned. */

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const year = parseInt(url.searchParams.get('year') || '') || new Date().getFullYear();
    const [rows, suggestions] = await Promise.all([getAwards(db, year), computeSuggestions(db, year)]);
    return new Response(JSON.stringify({ year, defs: AWARD_DEFS, awards: rows, suggestions }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const b = await request.json() as { year?: number; key?: string; playerId?: string | null; recipientName?: string | null; note?: string | null };
    const year = Number(b.year);
    const key = String(b.key || '');
    if (!year || !AWARD_DEFS.some(d => d.key === key)) {
      return new Response(JSON.stringify({ error: 'Bad year or award key' }), { status: 400 });
    }
    if (!b.playerId && !(b.recipientName || '').trim()) {
      return new Response(JSON.stringify({ error: 'Pick a player or type a recipient' }), { status: 400 });
    }
    await setAward(db, year, key, b.playerId || null, (b.recipientName || '').trim() || null, (b.note || '').trim() || null);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const b = await request.json() as { year?: number; key?: string };
    if (!b.year || !b.key) return new Response(JSON.stringify({ error: 'year and key required' }), { status: 400 });
    await removeAward(db, Number(b.year), String(b.key));
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
