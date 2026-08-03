import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, parseTokenPayload, getUserRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const payload = parseTokenPayload(token);
  if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  const rol = payload.r ?? getUserRole(payload.u);
  return NextResponse.json({ username: payload.u, rol });
}
