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
  const dir = req.nextUrl.searchParams.get('dir') ?? '';
  if (!dir || !isAllowed(dir)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  // Buscar por nombre de archivo (sin importar origenCarpeta) para cubrir docs movidos a subcarpetas
  const docs = await prisma.documento.findMany({
    select: { id: true, nombre: true, estado: true },
  });

  const status: Record<string, { estado: string; id: string }> = {};
  for (const doc of docs) {
    status[doc.nombre] = { estado: doc.estado, id: doc.id };
  }
  return NextResponse.json(status);
}
