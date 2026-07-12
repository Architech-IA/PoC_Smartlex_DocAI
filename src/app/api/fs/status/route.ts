import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

const INGESTA_BASE_PATH = process.env.INGESTA_BASE_PATH ?? '/app/ingesta';

function getRoots(): string[] {
  return (process.env.FS_EXPLORER_ROOTS ?? '').split(',').map(r => r.trim()).filter(Boolean);
}
function isAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  return getRoots().some(root => resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep));
}

function esBronze(dir: string): boolean {
  return path.resolve(dir).startsWith(path.resolve(INGESTA_BASE_PATH));
}

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get('dir') ?? '';
  if (!dir || !isAllowed(dir)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const docs = await prisma.documento.findMany({
    select: { id: true, nombre: true, estado: true, origenCarpeta: true },
  });

  const enBronze = esBronze(dir);
  const status: Record<string, { estado: string; id: string }> = {};

  for (const doc of docs) {
    const docEnSilver = doc.origenCarpeta && !doc.origenCarpeta.includes('ingesta');

    if (enBronze && docEnSilver) {
      // Archivo en BRONZE pero ya indexado en SILVER: mostrar estado especial
      status[doc.nombre] = { estado: 'EN_SILVER', id: doc.id };
    } else {
      status[doc.nombre] = { estado: doc.estado, id: doc.id };
    }
  }

  return NextResponse.json(status);
}
