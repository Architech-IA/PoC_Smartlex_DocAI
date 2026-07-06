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
    include: {
      proyecto: { select: { id: true, nombre: true } },
      versiones: {
        select: { id: true, versionNumero: true, createdAt: true, creadoPor: true, tamanoBytes: true, esVersionActual: true },
        orderBy: { versionNumero: 'asc' },
      },
      documentoPadre: {
        select: { id: true, versionNumero: true, nombre: true },
      },
      eventos: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, accion: true, actor: true, detalle: true, createdAt: true },
      },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const actor = req.headers.get('x-actor') ?? 'sistema';
  await logEvento({ entidad: 'DOCUMENTO', entidadId: id, accion: 'VER', actor });

  // Excluir archivoBase64 de la respuesta por defecto (es pesado)
  const { archivoBase64, ...resto } = doc;
  return NextResponse.json({ ...resto, tieneArchivo: !!archivoBase64 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json() as {
    estado?: string;
    proyectoId?: string;
    area?: string;
    resumen?: string;
    actor?: string;
  };
  const actor = body.actor ?? 'sistema';

  const doc = await prisma.documento.findUnique({ where: { id }, select: { id: true, estado: true } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const ESTADOS_VALIDOS = ['PROCESANDO', 'LISTO', 'ERROR', 'ARCHIVADO'];
  if (body.estado && !ESTADOS_VALIDOS.includes(body.estado)) {
    return NextResponse.json({ error: `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}` }, { status: 400 });
  }

  const actualizado = await prisma.documento.update({
    where: { id },
    data: {
      ...(body.estado ? { estado: body.estado } : {}),
      ...(body.proyectoId !== undefined ? { proyectoId: body.proyectoId } : {}),
      ...(body.area !== undefined ? { area: body.area } : {}),
      ...(body.resumen !== undefined ? { resumen: body.resumen } : {}),
    },
    select: { id: true, nombre: true, estado: true, area: true, resumen: true, proyectoId: true },
  });

  const accion = body.estado === 'ARCHIVADO' ? 'ARCHIVAR' : 'MODIFICAR';
  const detalle = body.estado === 'ARCHIVADO'
    ? `Documento archivado por ${actor}`
    : `Campos actualizados: ${Object.keys(body).filter(k => k !== 'actor').join(', ')}`;

  await logEvento({ entidad: 'DOCUMENTO', entidadId: id, accion, actor, detalle });

  return NextResponse.json(actualizado);
}
