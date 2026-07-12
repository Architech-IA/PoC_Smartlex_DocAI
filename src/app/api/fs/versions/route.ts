import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

function getRoots(): string[] {
  return (process.env.FS_EXPLORER_ROOTS ?? '').split(',').map(r => r.trim()).filter(Boolean);
}
function isAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  return getRoots().some(root => resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep));
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get('path') ?? '';
  if (!filePath || !isAllowed(filePath)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const nombre = path.basename(filePath);

  // Busca por nombre sin filtrar por origenCarpeta — el archivo puede estar
  // en BRONZE fisicamente pero su registro en DB apunta a SILVER
  const docs = await prisma.documento.findMany({
    where: { nombre },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nombre: true,
      estado: true,
      tamanoBytes: true,
      createdAt: true,
      resumen: true,
      tipo: true,
      area: true,
    },
  });

  return NextResponse.json(docs.map(d => ({ ...d, creadoEn: d.createdAt })));
}
