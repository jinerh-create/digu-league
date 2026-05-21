export const prerender = false;
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
    const month = url.searchParams.get('month');
    const type = url.searchParams.get('type') as 'single' | 'team' | null;
    const season = url.searchParams.get('season');
    const stats = await computePlayerStats(db, month ?? undefined, type ?? undefined, season ?? undefined);
    stats.sort((a, b) => {
      if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
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
