export const prerender = false;
import type { APIRoute } from 'astro';
import { computeOCChampions } from '../../../lib/db';

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB binding not found');
  return runtime.env.DB;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const result = await computeOCChampions(db);
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
