import { defineMiddleware } from 'astro:middleware';
import { verifySession } from '../lib/auth';

const ADMIN_PAGES = ['/players', '/new-match'];
const ADMIN_API_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, redirect } = context;
  const pathname = url.pathname;
  const method = request.method;

  // Always allow the login page itself
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return next();
  }

  const secret = (context.locals as Record<string, unknown>).runtime
    ? ((context.locals as Record<string, unknown>).runtime as { env: Record<string, string> }).env.SESSION_SECRET
    : (import.meta.env.SESSION_SECRET as string | undefined);

  if (!secret) {
    // No secret configured — allow everything (dev mode)
    return next();
  }

  const cookieHeader = request.headers.get('cookie');

  // Check if this route needs auth
  const isAdminPage = ADMIN_PAGES.some((p) => pathname.startsWith(p));
  const isMatchPage = pathname.startsWith('/match/');
  const isAdminApi = pathname.startsWith('/api/') && ADMIN_API_METHODS.includes(method);

  if (isAdminPage || isMatchPage || isAdminApi) {
    const valid = await verifySession(cookieHeader, secret);
    if (!valid) {
      if (pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  return next();
});
