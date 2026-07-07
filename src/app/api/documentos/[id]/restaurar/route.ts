import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logEvento } from '@/lib/auditoria';

// POST /api/documentos/[id]/restaurar
// Body: { versionId: string, actor?: string }
// Crea un nuevo Documento como siguiente versión en la cadena (no sobreescribe).
// La versión restaurada se convierte en la nueva esVersionActual.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { versionId, actor = 'sistema' } = body as { versionId: string; actor?: string };

    if (!versionId) {
      return NextResponse.json({ error: 'versionId requerido' }, { status: 400 });
    }

    // Cargar la versión a restaurar
    const origen = await prisma.documento.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        area: true,
        origen: true,
        origenCarpeta: true,
        archivoBase64: true,
        mimeType: true,
        tamanoBytes: true,
        hashSha256: true,
        resumen: true,
        datosClave: true,
        textoExtraido: true,
        proyectoId: true,
        versionNumero: true,
        documentoPadreId: true,
      },
    });
    if (!origen) {
      return NextResponse.json({ error: 'Versión origen no encontrada' }, { status: 404 });
    }

    // El documento actual (el que tiene id == params.id) es la esVersionActual
    const actual = await prisma.documento.findUnique({
      where: { id },
      select: { id: true, versionNumero: true, esVersionActual: true },
    });
    if (!actual) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const nuevoNumero = actual.versionNumero + 1;

    // Crear nuevo documento como siguiente versión
    const nueva = await prisma.documento.create({
      data: {
        nombre: origen.nombre,
        tipo: origen.tipo,
        area: origen.area,
        origen: origen.origen,
        origenCarpeta: origen.origenCarpeta,
        archivoBase64: origen.archivoBase64,
        mimeType: origen.mimeType,
        tamanoBytes: origen.tamanoBytes,
        // hashSha256 debe ser único — generamos uno basado en tiempo + versionId
        hashSha256: `restore_${versionId}_${Date.now()}`,
        resumen: origen.resumen,
        datosClave: origen.datosClave,
        textoExtraido: origen.textoExtraido,
        proyectoId: origen.proyectoId,
        documentoPadreId: id,
        esVersionActual: true,
        versionNumero: nuevoNumero,
        creadoPor: actor,
        estado: 'LISTO',
      },
    });

    // Marcar todas las versiones anteriores como no actuales
    await prisma.documento.updateMany({
      where: {
        id: { not: nueva.id },
        OR: [{ id }, { documentoPadreId: id }],
      },
      data: { esVersionActual: false },
    });

    // El documento actual (params.id) también deja de ser actual
    await prisma.documento.update({
      where: { id },
      data: { esVersionActual: false },
    });

    await logEvento({
      entidad: 'DOCUMENTO',
      entidadId: nueva.id,
      accion: 'RESTAURAR_VERSION',
      actor,
      detalle: `Restaurada desde v${origen.versionNumero} (${versionId}) → v${nuevoNumero}`,
    });

    return NextResponse.json({ id: nueva.id, versionNumero: nuevoNumero });
  } catch (err) {
    console.error('[restaurar/route] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
