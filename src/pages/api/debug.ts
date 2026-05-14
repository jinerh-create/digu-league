export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const runtime = (locals as Record<string, unknown>).runtime as Record<string, unknown> | undefined;
  const env = runtime?.env as Record<string, unknown> | undefined;
  const envKeys = env ? Object.keys(env) : [];
  return new Response(JSON.stringify({
    hasRuntime: !!runtime,
    envKeys,
    hasDB: !!env?.DB,
    hasAdminPassword: !!env?.ADMIN_PASSWORD,
    hasSessionSecret: !!env?.SESSION_SECRET,
  }), { headers: { 'Content-Type': 'application/json' } });
};
