export const prerender = false;
import type { APIRoute } from 'astro';
import { getReactions, addReaction, removeReaction } from '../../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const reactions = await getReactions(db, params.id!);
    // Return counts per emoji + list of ids for this session
    const counts: Record<string, number> = {};
    const ids: Record<string, string[]> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (!ids[r.emoji]) ids[r.emoji] = [];
      ids[r.emoji].push(r.id);
    }
    return new Response(JSON.stringify({ counts, ids, total: reactions.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

// POST to add a reaction: body { emoji }
// Returns the new reaction id so client can undo
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as { emoji?: string };
    const emoji = body.emoji?.trim();
    if (!emoji) return new Response(JSON.stringify({ error: 'emoji required' }), { status: 400 });
    const id = crypto.randomUUID();
    await addReaction(db, id, params.id!, emoji, new Date().toISOString());
    return new Response(JSON.stringify({ ok: true, id }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

// DELETE to remove a reaction: body { reactionId }
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as { reactionId?: string };
    if (!body.reactionId) return new Response(JSON.stringify({ error: 'reactionId required' }), { status: 400 });
    await removeReaction(db, body.reactionId);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
