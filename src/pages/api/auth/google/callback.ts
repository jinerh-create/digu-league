export const prerender = false;
import type { APIRoute } from 'astro';
import {
  verifyStateCookie,
  clearStateCookie,
  createSessionCookie,
  emailFromIdToken,
} from '../../../../lib/auth';

const secretOf = (env?: Record<string, string>) =>
  (env?.SESSION_SECRET ?? (import.meta.env.SESSION_SECRET as string) ?? 'dev-digu-league-secret').trim();

/** Comma/space-separated list of emails allowed to sign in as ADMIN via Google. */
const adminEmailsOf = (env?: Record<string, string>): string[] => {
  const raw =
    env?.GOOGLE_ADMIN_EMAILS ??
    (import.meta.env.GOOGLE_ADMIN_EMAILS as string) ??
    'jinerh@gmail.com';
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
};

export const GET: APIRoute = async ({ request, locals, redirect, url }) => {
  const env = (locals as any).runtime?.env as Record<string, string> | undefined;
  const clientId = env?.GOOGLE_CLIENT_ID ?? (import.meta.env.GOOGLE_CLIENT_ID as string);
  const clientSecret = env?.GOOGLE_CLIENT_SECRET ?? (import.meta.env.GOOGLE_CLIENT_SECRET as string);
  const secret = secretOf(env);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  if (url.searchParams.get('error') || !code) return redirect('/login?err=google_denied');
  if (!clientId || !clientSecret) return redirect('/login?err=not_configured');
  if (!(await verifyStateCookie(request.headers.get('cookie'), secret, 'google', state)))
    return redirect('/login?err=invalid_state');

  // Exchange the code for tokens (includes an id_token JWT with the user's email)
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return redirect('/login?err=token_exchange');

  const tokens = (await tokenRes.json()) as { id_token?: string };
  const { email, verified } = emailFromIdToken(tokens.id_token);
  if (!email || !verified) return redirect('/login?err=no_email');

  // Only allow-listed emails may sign in — as ADMIN.
  const allowed = adminEmailsOf(env);
  if (!allowed.includes(email)) return redirect('/login?err=not_authorized');

  const headers = new Headers();
  headers.append('Set-Cookie', await createSessionCookie(secret, 'admin'));
  headers.append('Set-Cookie', clearStateCookie());
  headers.set('Location', '/');
  return new Response(null, { status: 302, headers });
};
