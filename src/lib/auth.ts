const COOKIE_NAME = 'dl_session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

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

export async function createSessionCookie(secret: string): Promise<string> {
  const payload = `dl_auth_${Date.now()}`;
  const sig = await hmacSign(secret, payload);
  const token = `${btoa(payload)}.${sig}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

export async function verifySession(
  cookieHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!cookieHeader) return false;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  const [encodedPayload, sig] = token.split('.');
  if (!encodedPayload || !sig) return false;
  try {
    const payload = atob(encodedPayload);
    return hmacVerify(secret, payload, sig);
  } catch {
    return false;
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
