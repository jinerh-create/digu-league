export const prerender = false;
import type { APIRoute } from 'astro';
import { createSessionCookie } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as Record<string, unknown>).runtime as
    | { env: Record<string, string> }
    | undefined;

  const adminPassword = (runtime?.env.ADMIN_PASSWORD ?? import.meta.env.ADMIN_PASSWORD)?.trim();
  const playerPassword = (runtime?.env.PLAYER_PASSWORD ?? import.meta.env.PLAYER_PASSWORD)?.trim();
  const sessionSecret = (runtime?.env.SESSION_SECRET ?? import.meta.env.SESSION_SECRET)?.trim();

  if (!adminPassword || !sessionSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const pw = body.password;
  const requestedRole = body.role; // 'player' or 'admin' sent from frontend

  if (!pw) {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400 });
  }

  // Strict role enforcement:
  // If player tab → only player password works
  // If admin tab → only admin password works
  let role: 'admin' | 'player' | null = null;

  if (requestedRole === 'player') {
    // Player login: only accept player password
    if (playerPassword && pw === playerPassword) {
      role = 'player';
    }
  } else if (requestedRole === 'admin') {
    // Admin login: only accept admin password
    if (pw === adminPassword) {
      role = 'admin';
    }
  } else {
    // No role specified: try both (backward compat)
    if (pw === adminPassword) role = 'admin';
    else if (playerPassword && pw === playerPassword) role = 'player';
  }

  if (!role) {
    return new Response(JSON.stringify({ error: 'Incorrect password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookie = await createSessionCookie(sessionSecret, role);

  return new Response(JSON.stringify({ ok: true, role }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};
