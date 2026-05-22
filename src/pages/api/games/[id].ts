export const prerender = false;
import type { APIRoute } from 'astro';
import { updateGameGin, updateGame, getGame, deleteGame } from '../../../lib/db';
import { verifySession } from '../../../lib/auth';
import { getMatch } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

function getSecret(locals: Record<string, unknown>): string | undefined {
  const runtime = locals.runtime as { env: Record<string, string> } | undefined;
  return (runtime?.env.SESSION_SECRET ?? (import.meta.env.SESSION_SECRET as string | undefined))?.trim();
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const { id } = params;
    if (!id) return new Response(JSON.stringify({ error: 'Game ID required' }), { status: 400 });
    const body = await request.json() as {
      is_gin?: number;
      gin_player_id?: string | null;
      winner_id?: string;
      loser_id?: string;
      score_awarded?: number;
      t1_p1_cards?: number | null;
      t1_p2_cards?: number | null;
      t2_p1_cards?: number | null;
      t2_p2_cards?: number | null;
    };
    if (body.winner_id !== undefined) {
      await updateGame(
        db, id,
        body.winner_id, body.loser_id!,
        body.score_awarded ?? 0,
        body.is_gin ?? 0, body.gin_player_id ?? null,
        body.t1_p1_cards, body.t1_p2_cards, body.t1_p2_cards, body.t2_p2_cards
      );
    } else {
      await updateGameGin(db, id, body.is_gin ?? 0, body.gin_player_id ?? null);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const { id } = params;
    if (!id) return new Response(JSON.stringify({ error: 'Game ID required' }), { status: 400 });

    const game = await getGame(db, id);
    if (!game) return new Response(JSON.stringify({ error: 'Round not found' }), { status: 404 });

    const match = await getMatch(db, game.match_id);
    if (!match) return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });

    // If match is completed, only admin can delete
    if (match.completed_at) {
      const secret = getSecret(locals as Record<string, unknown>);
      if (secret) {
        const cookieHeader = request.headers.get('cookie');
        const { role } = await verifySession(cookieHeader, secret);
        if (role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Only admin can delete rounds after match is finished' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    await deleteGame(db, id);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
