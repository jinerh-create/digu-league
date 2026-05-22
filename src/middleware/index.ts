import { defineMiddleware } from 'astro:middleware';
import { verifySession } from '../lib/auth';

// Pages only admins can reach
const ADMIN_ONLY_PAGES = ['/players', '/new-match'];

// APIs only admins can call
const ADMIN_ONLY_API_PREFIXES = [
  '/api/players',
  '/api/matches',   // POST create match — players can't start matches
  '/api/seasons',
  '/api/scheduled',
];

// APIs players + admins can call
const PLAYER_API_METHODS = ['POST', 'PATCH', 'DELETE'];
const PLAYER_API_PREFIXES = [
  '/api/games',            // PATCH/DELETE individual game rounds
];

function getSecret(locals: unknown): string | undefined {
  const l = locals as Record<string, unknown>;
  return (l.runtime
    ? (l.runtime as { env: Record<string, string> }).env.SESSION_SECRET
    : (import.meta.env.SESSION_SECRET as string | undefined))?.trim();
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, redirect } = context;
  const pathname = url.pathname;
  const method = request.method;

  // Always allow login and auth API
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return next();
  }

  const secret = getSecret(context.locals);
  if (!secret) return next(); // dev: no secret → open

  const cookieHeader = request.headers.get('cookie');
  const { valid, role } = await verifySession(cookieHeader, secret);

  const isAdminOnlyPage = ADMIN_ONLY_PAGES.some(p => pathname.startsWith(p));
  const isMatchPage = pathname.startsWith('/match/') || pathname.startsWith('/scoresheet/');

  // Admin-only page → must be admin
  if (isAdminOnlyPage) {
    if (!valid || role !== 'admin') {
      return redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
    return next();
  }

  // Match/scoresheet pages → any authenticated user (admin or player)
  if (isMatchPage) {
    if (!valid) return redirect(`/login?next=${encodeURIComponent(pathname)}`);
    return next();
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    if (method === 'GET') return next(); // all GETs are public

    // Games API (PATCH, DELETE) — players and admins allowed
    const isPlayerApi = PLAYER_API_PREFIXES.some(p => pathname.startsWith(p)) &&
      PLAYER_API_METHODS.includes(method);

    // Match games POST (add round) — players and admins allowed
    const isAddGame = /^\/api\/matches\/[^/]+\/games$/.test(pathname) && method === 'POST';
    const isFinishMatch = /^\/api\/matches\/[^/]+\/finish$/.test(pathname) && method === 'POST';

    if (isPlayerApi || isAddGame || isFinishMatch) {
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return next();
    }

    // Everything else is admin-only
    const needsAdmin = method !== 'GET';
    if (needsAdmin) {
      if (!valid || role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  return next();
});
