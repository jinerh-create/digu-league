import { defineMiddleware } from 'astro:middleware';
import { verifySession } from '../lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/manifest.webmanifest',
  '/sw.js',
  '/logo.png',
  '/logo.svg',
  '/favicon.ico',
  '/robots.txt',
];

const ADMIN_ONLY_PAGES = ['/players'];

const ADMIN_ONLY_API = ['/api/players', '/api/seasons', '/api/scheduled'];

function getSecret(locals: unknown): string | undefined {
  const l = locals as Record<string, unknown>;
  const runtime = l.runtime as { env?: Record<string, string> } | undefined;
  const fromRuntime = runtime?.env?.SESSION_SECRET;
  const fromMeta = import.meta.env.SESSION_SECRET as string | undefined;
  return (fromRuntime ?? fromMeta)?.trim();
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/_astro/')) return true;
  if (pathname.startsWith('/badges/')) return true;
  if (/\.(png|svg|ico|jpg|jpeg|webp|woff2?|ttf|css|js)$/.test(pathname)) return true;
  return false;
}

function hasCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes('dl_session=');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, redirect } = context;
  const pathname = url.pathname;
  const method = request.method;

  // Always allow public paths
  if (isPublic(pathname)) return next();

  const cookieHeader = request.headers.get('cookie');

  // Fast gate: no cookie at all → redirect immediately (no need to check secret)
  if (!hasCookie(cookieHeader)) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  // Full verification (only if secret is available — skip HMAC check in dev/missing secret)
  const secret = getSecret(context.locals);

  let role: 'admin' | 'player' | null = null;
  let valid = false;

  if (secret) {
    const result = await verifySession(cookieHeader, secret);
    valid = result.valid;
    role = result.role;
  } else {
    // No secret configured — treat cookie presence as valid (dev mode fallback)
    valid = true;
    role = 'admin';
  }

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  // Admin-only pages
  if (ADMIN_ONLY_PAGES.some(p => pathname.startsWith(p))) {
    if (role !== 'admin') {
      return redirect('/login?next=' + encodeURIComponent(pathname));
    }
    return next();
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    if (method === 'GET') return next();

    // Admin-only API mutations
    if (ADMIN_ONLY_API.some(p => pathname.startsWith(p))) {
      if (role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        });
      }
      return next();
    }

    // Player + admin allowed mutations
    const isGameMutation = pathname.startsWith('/api/games') && ['POST','PATCH','DELETE'].includes(method);
    const isCreateMatch = pathname === '/api/matches' && method === 'POST';
    const isCreateClassic = pathname === '/api/classic' && method === 'POST';
    const isAddGame = /^\/api\/matches\/[^/]+\/games$/.test(pathname) && method === 'POST';
    const isFinishMatch = /^\/api\/matches\/[^/]+\/finish$/.test(pathname) && method === 'POST';

    if (isGameMutation || isCreateMatch || isCreateClassic || isAddGame || isFinishMatch) return next();

    // Everything else: admin only
    if (role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return next();
});
