import type { APIRoute } from 'astro';
import { createSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as Record<string, unknown>).runtime as
    | { env: Record<string, string> }
    | undefined;

  const adminPassword = runtime?.env.ADMIN_PASSWORD ?? import.meta.env.ADMIN_PASSWORD;
  const sessionSecret = runtime?.env.SESSION_SECRET ?? import.meta.env.SESSION_SECRET;

  if (!adminPassword || !sessionSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!body.password || body.password !== adminPassword) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookie = await createSessionCookie(sessionSecret);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};
