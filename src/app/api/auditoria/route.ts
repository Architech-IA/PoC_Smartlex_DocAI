import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/auditoria?documento=&accion=CREAR,VER&desde=2026-01-01&hasta=2026-12-31&actor=&page=1&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const documento = sp.get('documento') ?? undefined;
  const acciones = sp.get('accion') ? sp.get('accion')!.split(',').filter(Boolean) : undefined;
  const desde = sp.get('desde') ? new Date(sp.get('desde')!) : undefined;
  const hasta = sp.get('hasta') ? new Date(sp.get('hasta')! + 'T23:59:59') : undefined;
  const actor = sp.get('actor') ?? undefined;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const limit = Math.min(200, parseInt(sp.get('limit') ?? '50'));

  try {
    // Si filtran por nombre de documento, primero resolvemos los ids
    let entidadIds: string[] | undefined;
    if (documento) {
      const docs = await prisma.documento.findMany({
        where: {
          OR: [
            { id: { contains: documento } },
            { nombre: { contains: documento, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 100,
      });
      entidadIds = docs.map((d) => d.id);
      if (entidadIds.length === 0) {
        return NextResponse.json({ eventos: [], total: 0, page, limit });
      }
    }

    const where = {
      ...(entidadIds ? { entidadId: { in: entidadIds } } : {}),
      ...(acciones && acciones.length > 0 ? { accion: { in: acciones } } : {}),
      ...(actor ? { actor: { contains: actor, mode: 'insensitive' as const } } : {}),
      ...(desde || hasta
        ? {
            createdAt: {
              ...(desde ? { gte: desde } : {}),
              ...(hasta ? { lte: hasta } : {}),
            },
          }
        : {}),
    };

    const [total, eventos] = await Promise.all([
      prisma.eventoAuditoria.count({ where }),
      prisma.eventoAuditoria.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          documento: {
            select: { id: true, nombre: true },
          },
        },
      }),
    ]);

    return NextResponse.json({ eventos, total, page, limit });
  } catch (err) {
    console.error('[auditoria/route] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
