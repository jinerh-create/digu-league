import { defineMiddleware } from 'astro:middleware';
import { verifySession } from '../lib/auth';

// Pages only admins can reach
const ADMIN_ONLY_PAGES = ['/players'];

// APIs only admins can call
const ADMIN_ONLY_API_PREFIXES = [
  '/api/players',
  '/api/seasons',
  '/api/scheduled',
];

// APIs players + admins can call
const PLAYER_API_METHODS = ['POST', 'PATCH', 'DELETE'];
const PLAYER_API_PREFIXES = [
  '/api/games',
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

  // Always allow login page, auth API, static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/badges/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/logo.png' ||
    pathname === '/logo.svg' ||
    pathname === '/favicon.ico'
  ) {
    return next();
  }

  const secret = getSecret(context.locals);
  if (!secret) return next(); // dev: no secret → open

  const cookieHeader = request.headers.get('cookie');
  const { valid, role } = await verifySession(cookieHeader, secret);

  // ── Not logged in → redirect all pages to login ──
  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  // ── Logged in ──────────────────────────────────────

  // Admin-only pages
  if (ADMIN_ONLY_PAGES.some(p => pathname.startsWith(p))) {
    if (role !== 'admin') return redirect('/login?next=' + encodeURIComponent(pathname));
    return next();
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    if (method === 'GET') return next();

    const isPlayerApi = PLAYER_API_PREFIXES.some(p => pathname.startsWith(p)) &&
      PLAYER_API_METHODS.includes(method);
    const isCreateMatch = pathname === '/api/matches' && method === 'POST';
    const isAddGame = /^\/api\/matches\/[^/]+\/games$/.test(pathname) && method === 'POST';
    const isFinishMatch = /^\/api\/matches\/[^/]+\/finish$/.test(pathname) && method === 'POST';

    if (isPlayerApi || isCreateMatch || isAddGame || isFinishMatch) {
      return next(); // both roles allowed
    }

    // Admin-only API actions
    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
