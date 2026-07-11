import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'sl_session';
const SECRET = process.env.SESSION_SECRET ?? 'smartlex-secret-key-2026';

async function verifyToken(token: string): Promise<boolean> {
  try {
    const lastDot = token.lastIndexOf('.');
    if (lastDot < 0) return false;
    const payload = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // base64url → ArrayBuffer
    const sigBytes = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payload),
    );
    if (!valid) return false;

    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json.exp > Date.now();
  } catch {
    return false;
  }
}

const PUBLIC = ['/login', '/api/auth/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
