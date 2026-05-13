import type { APIRoute } from 'astro';
import { computePlayerStats } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const month = url.searchParams.get('month'); // e.g. "2026-05"
    const stats = await computePlayerStats(db, month ?? undefined);
    stats.sort((a, b) => {
      if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
      return b.total_points_scored - a.total_points_scored;
    });
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
