export const prerender = false;
import type { APIRoute } from 'astro';
import { getClassicMatches, createMatch, createGuestPlayer, getPlayer } from '../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

type Slot = { id?: string; name?: string } | null | undefined;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const matches = await getClassicMatches(db);
    return new Response(JSON.stringify(matches), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const body = await request.json() as {
      p1a?: Slot; p2a?: Slot; p1b?: Slot; p2b?: Slot;
      target_score?: number; max_rounds?: number;
      team1_name?: string | null; team2_name?: string | null;
    };

    const now = new Date().toISOString();

    // Resolve a slot to a player id. Existing → validate & reuse; guest name → create guest row.
    async function resolve(slot: Slot, required: boolean): Promise<string | null> {
      if (!slot) { if (required) throw new Error('Both players are required'); return null; }
      if (slot.id) {
        const p = await getPlayer(db, slot.id);
        if (!p) throw new Error('Selected player not found');
        return slot.id;
      }
      const name = (slot.name ?? '').trim().slice(0, 40);
      if (!name) { if (required) throw new Error('Enter or pick both players'); return null; }
      const gid = crypto.randomUUID();
      await createGuestPlayer(db, gid, name, now);
      return gid;
    }

    // Resolve captains first (required), then optional partners.
    const player1_id = await resolve(body.p1a, true);
    const player2_id = await resolve(body.p2a, true);
    if (!player1_id || !player2_id) {
      return new Response(JSON.stringify({ error: 'Both players are required' }), { status: 400 });
    }
    const team1_player2_id = await resolve(body.p1b, false);
    const team2_player2_id = await resolve(body.p2b, false);

    // Prevent the SAME existing player being picked twice (guests are always unique).
    const existingIds = [player1_id, player2_id, team1_player2_id, team2_player2_id].filter(Boolean) as string[];
    // only guard duplicates that come from real selections (a guest UUID can't collide)
    const dupCheck = new Set<string>();
    for (const s of [body.p1a, body.p2a, body.p1b, body.p2b]) {
      if (s?.id) {
        if (dupCheck.has(s.id)) return new Response(JSON.stringify({ error: 'Each player can only appear once' }), { status: 400 });
        dupCheck.add(s.id);
      }
    }
    void existingIds;

    const maxRounds = body.max_rounds ?? 0;
    const targetScore = maxRounds > 0 ? 0 : (body.target_score ?? 100);
    if (maxRounds > 0 && maxRounds < 5) {
      return new Response(JSON.stringify({ error: 'Minimum 5 rounds' }), { status: 400 });
    }
    if (maxRounds === 0 && (targetScore < 10 || targetScore > 10000)) {
      return new Response(JSON.stringify({ error: 'Invalid target score' }), { status: 400 });
    }

    const id = crypto.randomUUID();
    await createMatch(
      db, id, player1_id, player2_id, targetScore, now,
      team1_player2_id ? (body.team1_name?.trim() || 'Team A') : null,
      team1_player2_id ? (body.team2_name?.trim() || 'Team B') : null,
      team1_player2_id, team2_player2_id,
      maxRounds, null, 1 // season_id null, is_classic = 1
    );

    return new Response(JSON.stringify({ id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 400 });
  }
};
