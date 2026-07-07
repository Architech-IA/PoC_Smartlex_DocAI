import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Devuelve la cadena completa de versiones ordenada por versionNumero.
// Sube hasta la raíz (sin documentoPadreId) y luego trae todos los descendientes.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const doc = await prisma.documento.findUnique({
      where: { id },
      select: { id: true, documentoPadreId: true },
    });
    if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // Subir hasta la raíz
    let raizId = id;
    let cursor = doc.documentoPadreId;
    while (cursor) {
      const padre = await prisma.documento.findUnique({
        where: { id: cursor },
        select: { id: true, documentoPadreId: true },
      });
      if (!padre) break;
      raizId = padre.id;
      cursor = padre.documentoPadreId;
    }

    // Traer toda la cadena descendente desde la raíz
    const cadena = await obtenerCadena(raizId);
    cadena.sort((a, b) => a.versionNumero - b.versionNumero);

    return NextResponse.json(cadena);
  } catch (err) {
    console.error('[versiones/route] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function obtenerCadena(docId: string): Promise<VersionDoc[]> {
  const doc = await prisma.documento.findUnique({
    where: { id: docId },
    select: {
      id: true,
      nombre: true,
      versionNumero: true,
      esVersionActual: true,
      creadoPor: true,
      tamanoBytes: true,
      estado: true,
      createdAt: true,
      versiones: { select: { id: true } },
    },
  });
  if (!doc) return [];

  const resultado: VersionDoc[] = [
    {
      id: doc.id,
      nombre: doc.nombre,
      versionNumero: doc.versionNumero,
      esVersionActual: doc.esVersionActual,
      creadoPor: doc.creadoPor ?? null,
      tamanoBytes: doc.tamanoBytes ?? null,
      estado: doc.estado,
      createdAt: doc.createdAt,
    },
  ];

  for (const hijo of doc.versiones) {
    const sub = await obtenerCadena(hijo.id);
    resultado.push(...sub);
  }

  return resultado;
}

interface VersionDoc {
  id: string;
  nombre: string;
  versionNumero: number;
  esVersionActual: boolean;
  creadoPor: string | null;
  tamanoBytes: number | null;
  estado: string;
  createdAt: Date;
}
