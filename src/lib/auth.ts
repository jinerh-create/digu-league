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
