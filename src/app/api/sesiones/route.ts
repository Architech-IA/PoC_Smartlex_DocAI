import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, parseTokenPayload, getUserRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? parseTokenPayload(token) : null;
  const rol = payload?.r ?? (payload ? getUserRole(payload.u) : null);
  if (!payload || rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string; username: string; rol: string; ip: string | null;
    userAgent: string | null; createdAt: Date;
  }>>(
    `SELECT id, username, rol, ip, "userAgent", "createdAt" FROM "SesionLogin" ORDER BY "createdAt" DESC LIMIT 200`,
  );

  return NextResponse.json(rows);
}
