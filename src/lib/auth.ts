import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET ?? 'smartlex-secret-key-2026';
export const COOKIE_NAME = 'sl_session';
export const MAX_AGE = 60 * 60 * 8;

export type UserRole = 'admin' | 'socio';

interface UserDef { password: string; rol: UserRole; }

const USERS: Record<string, UserDef> = {
  adminAT:       { password: 'admin123',      rol: 'admin' },
  adminSmartlex: { password: 'Smartlex2026*', rol: 'socio' },
};

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function createSessionToken(username: string): string {
  const rol = USERS[username]?.rol ?? 'socio';
  const payload = base64url(Buffer.from(JSON.stringify({ u: username, r: rol, exp: Date.now() + MAX_AGE * 1000 })));
  const sig = base64url(createHmac('sha256', SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function checkCredentials(username: string, password: string): boolean {
  const user = USERS[username];
  if (!user) return false;
  try {
    return timingSafeEqual(Buffer.from(password), Buffer.from(user.password));
  } catch { return false; }
}

export function getUserRole(username: string): UserRole {
  return USERS[username]?.rol ?? 'socio';
}

export interface TokenPayload { u: string; r: UserRole; exp: number; }

export function parseTokenPayload(token: string): TokenPayload | null {
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot < 0) return null;
    const payload = token.slice(0, lastDot);
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const json = JSON.parse(decoded) as TokenPayload;
    if (json.exp < Date.now()) return null;
    return json;
  } catch { return null; }
}
