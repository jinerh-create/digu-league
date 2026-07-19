export type UserRole = 'admin' | 'player';

const COOKIE_NAME = 'dl_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days — stay logged in

async function hmacSign(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(secret: string, value: string, sig: string): Promise<boolean> {
  const expected = await hmacSign(secret, value);
  return expected === sig;
}

export async function createSessionCookie(secret: string, role: UserRole = 'admin'): Promise<string> {
  const payload = `dl_auth:${role}:${Date.now()}`;
  const sig = await hmacSign(secret, payload);
  const token = `${btoa(payload)}.${sig}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

export async function verifySession(
  cookieHeader: string | null,
  secret: string
): Promise<{ valid: boolean; role: UserRole | null }> {
  if (!cookieHeader) return { valid: false, role: null };
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return { valid: false, role: null };
  const [encodedPayload, sig] = token.split('.');
  if (!encodedPayload || !sig) return { valid: false, role: null };
  try {
    const payload = atob(encodedPayload);
    const ok = await hmacVerify(secret, payload, sig);
    if (!ok) return { valid: false, role: null };
    // Parse role from payload: dl_auth:ROLE:TIMESTAMP or legacy dl_auth_TIMESTAMP
    const parts = payload.split(':');
    const role: UserRole = parts[1] === 'player' ? 'player' : 'admin';
    return { valid: true, role };
  } catch {
    return { valid: false, role: null };
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Google OAuth CSRF state (stateless, signed cookie — no KV needed) ──
const STATE_COOKIE = 'dl_oauth_state';

export async function createStateCookie(secret: string, provider: string, state: string): Promise<string> {
  const payload = `${provider}:${state}`;
  const sig = await hmacSign(secret, payload);
  const token = `${btoa(payload)}.${sig}`;
  return `${STATE_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
}

export async function verifyStateCookie(
  cookieHeader: string | null,
  secret: string,
  provider: string,
  state: string
): Promise<boolean> {
  if (!cookieHeader || !state) return false;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );
  const token = cookies[STATE_COOKIE];
  if (!token) return false;
  const [encodedPayload, sig] = token.split('.');
  if (!encodedPayload || !sig) return false;
  try {
    const payload = atob(encodedPayload);
    if (!(await hmacVerify(secret, payload, sig))) return false;
    return payload === `${provider}:${state}`;
  } catch {
    return false;
  }
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Decode the email out of a Google id_token (JWT). No signature check needed — it came straight from Google's HTTPS token endpoint. */
export function emailFromIdToken(idToken: string | undefined): { email: string | null; verified: boolean } {
  if (!idToken) return { email: null, verified: false };
  const parts = idToken.split('.');
  if (parts.length < 2) return { email: null, verified: false };
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = JSON.parse(atob(b64)) as { email?: string; email_verified?: boolean | string };
    const email = (json.email ?? '').trim().toLowerCase() || null;
    const verified = json.email_verified === true || json.email_verified === 'true';
    return { email, verified };
  } catch {
    return { email: null, verified: false };
  }
}
