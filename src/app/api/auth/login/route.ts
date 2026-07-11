import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, COOKIE_NAME, MAX_AGE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json() as { username?: string; password?: string };
  const { username = '', password = '' } = body;

  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  }

  const token = createSessionToken(username);
  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return res;
}
