import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET ?? 'smartlex-secret-key-2026';
export const COOKIE_NAME = 'sl_session';
export const MAX_AGE = 60 * 60 * 8; // 8 horas

const USERS: Record<string, string> = {
  adminAT: 'admin123',
};

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function createSessionToken(username: string): string {
  const payload = base64url(Buffer.from(JSON.stringify({ u: username, exp: Date.now() + MAX_AGE * 1000 })));
  const sig = base64url(createHmac('sha256', SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function checkCredentials(username: string, password: string): boolean {
  const expected = USERS[username];
  if (!expected) return false;
  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch { return false; }
}
