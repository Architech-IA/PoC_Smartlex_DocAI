import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, getUserRole, COOKIE_NAME, MAX_AGE } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json() as { username?: string; password?: string };
  const { username = '', password = '' } = body;

  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  }

  const token = createSessionToken(username);
  const rol = getUserRole(username);

  // Registrar sesión
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SesionLogin" (id, username, rol, ip, "userAgent", "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
      crypto.randomUUID(),
      username,
      rol,
      req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      req.headers.get('user-agent') ?? null,
    );
  } catch { /* no bloquear el login si falla el log */ }

  const res = NextResponse.json({ ok: true, username, rol });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return res;
}
