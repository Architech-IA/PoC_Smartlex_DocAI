import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logEvento } from '@/lib/auditoria';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const doc = await prisma.documento.findUnique({
    where: { id },
    select: { nombre: true, archivoBase64: true, mimeType: true, estado: true },
  });

  if (!doc || !doc.archivoBase64) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 });
  }

  const buffer = Buffer.from(doc.archivoBase64, 'base64');
  const actor = req.headers.get('x-actor') ?? 'sistema';
  await logEvento({ entidad: 'DOCUMENTO', entidadId: id, accion: 'DESCARGAR', actor, detalle: doc.nombre });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': doc.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.nombre)}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
