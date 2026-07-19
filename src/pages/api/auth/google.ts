export const prerender = false;
import type { APIRoute } from 'astro';
import { createStateCookie } from '../../../lib/auth';

const secretOf = (env?: Record<string, string>) =>
  (env?.SESSION_SECRET ?? (import.meta.env.SESSION_SECRET as string) ?? 'dev-digu-league-secret').trim();

export const GET: APIRoute = async ({ locals, redirect, url }) => {
  const env = (locals as any).runtime?.env as Record<string, string> | undefined;
  const clientId = env?.GOOGLE_CLIENT_ID ?? (import.meta.env.GOOGLE_CLIENT_ID as string);
  if (!clientId) return redirect('/login?err=not_configured');

  const state = crypto.randomUUID();
  const stateCookie = await createStateCookie(secretOf(env), 'google', state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'Set-Cookie': stateCookie },
  });
};
