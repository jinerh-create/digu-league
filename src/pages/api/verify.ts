export const prerender = false;
import type { APIRoute } from 'astro';
import { requestVerification, setVerified, getVerificationRequests } from '../../lib/db';
import { verifySession } from '../../lib/auth';

/* Player verification.
   - GET  → pending requests (any signed-in user; middleware allows GET).
   - POST { playerId, action:'request' } → a player asks to be verified. Allowed for
     everyone signed in — it only raises a flag and can never self-verify.
   - POST { playerId, action:'approve'|'reject' } → ADMIN ONLY, enforced here (the
     request action needs to reach non-admins, so this route is whitelisted in
     middleware and does its own admin check for the decisions). */

function getDB(locals: Record<string, unknown>): D1Database {
  const runtime = locals.runtime as { env: { DB: D1Database } } | undefined;
  if (!runtime?.env?.DB) throw new Error('DB not found');
  return runtime.env.DB;
}

async function isAdmin(request: Request, locals: Record<string, unknown>): Promise<boolean> {
  const runtime = locals.runtime as { env?: { SESSION_SECRET?: string } } | undefined;
  const secret = runtime?.env?.SESSION_SECRET;
  if (!secret) return true; // dev fallback (matches middleware)
  const r = await verifySession(request.headers.get('cookie'), secret);
  return r.valid && r.role === 'admin';
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const requests = await getVerificationRequests(db);
    return new Response(JSON.stringify({ requests }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDB(locals as Record<string, unknown>);
    const b = await request.json() as { playerId?: string; action?: string };
    const playerId = String(b.playerId || '');
    if (!playerId) return new Response(JSON.stringify({ error: 'playerId required' }), { status: 400 });

    if (b.action === 'request') {
      await requestVerification(db, playerId);
    } else if (b.action === 'approve' || b.action === 'reject') {
      if (!(await isAdmin(request, locals as Record<string, unknown>))) {
        return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403 });
      }
      await setVerified(db, playerId, b.action === 'approve');
    } else {
      return new Response(JSON.stringify({ error: 'action must be request|approve|reject' }), { status: 400 });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
};
