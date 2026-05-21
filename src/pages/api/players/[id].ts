export const prerender = false;
import type { APIRoute } from 'astro';
import { getPlayer, updatePlayerAvatar, updatePlayerActive, updatePlayerName, updatePlayerNickname } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const player = await getPlayer(db, params.id!);
    if (!player) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify(player), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as { avatar_b64?: string; active?: number; name?: string; nickname?: string | null };

    if (body.name !== undefined) {
      const trimmed = body.name.trim();
      if (!trimmed) return new Response(JSON.stringify({ error: 'Name required' }), { status: 400 });
      await updatePlayerName(db, params.id!, trimmed);
    }
    if (body.avatar_b64 !== undefined) {
      if (body.avatar_b64.length > 280000) {
        return new Response(JSON.stringify({ error: 'Avatar too large' }), { status: 400 });
      }
      await updatePlayerAvatar(db, params.id!, body.avatar_b64);
    }
    if (body.nickname !== undefined) {
      await updatePlayerNickname(db, params.id!, body.nickname || null);
    }
    if (body.active !== undefined) {
      await updatePlayerActive(db, params.id!, body.active);
    }

    const player = await getPlayer(db, params.id!);
    return new Response(JSON.stringify(player), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
