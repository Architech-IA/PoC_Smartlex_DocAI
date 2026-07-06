import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runSkill } from '@/lib/claudeCode';
import { getEmbedding } from '@/lib/embeddings';
import { logEvento } from '@/lib/auditoria';
import { generarDocx, type ActaData } from '@/lib/docx';
import { createHash } from 'node:crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { texto?: string; proyectoId?: string; actor?: string };
    const { texto, proyectoId, actor = 'sistema' } = body;

    if (!texto || texto.trim().length === 0) {
      return NextResponse.json({ error: 'Se requiere el texto del transcript' }, { status: 400 });
    }

    // Invocar Skill generar-acta
    const salidaRaw = await runSkill('generar-acta', texto.slice(0, 12_000));

    let acta: ActaData;
    try {
      acta = JSON.parse(salidaRaw) as ActaData;
    } catch {
      return NextResponse.json({ error: 'La Skill no devolvió JSON válido', raw: salidaRaw }, { status: 500 });
    }

    // Generar .docx en memoria
    const docxBuffer = await generarDocx(acta);
    const archivoBase64 = docxBuffer.toString('base64');
    const hashSha256 = createHash('sha256').update(docxBuffer).digest('hex');

    // Verificar duplicado
    const existente = await prisma.documento.findUnique({ where: { hashSha256 } });
    if (existente) {
      return NextResponse.json({ error: 'Este acta ya existe', documentoId: existente.id }, { status: 409 });
    }

    // Generar embedding del resumen + puntos tratados
    const textoEmbedding = [acta.resumen, ...acta.puntosTratados].join(' ');
    let embedding: number[] = [];
    try {
      embedding = await getEmbedding(textoEmbedding);
    } catch {
      // embedding falla silencioso — el acta se guarda igual
    }

    // Guardar Documento
    const doc = await prisma.documento.create({
      data: {
        nombre: `${acta.titulo ?? 'Acta'} — ${acta.fecha ?? new Date().toISOString().slice(0, 10)}.docx`,
        tipo: 'ACTA',
        origen: 'GENERADO',
        archivoBase64,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        tamanoBytes: docxBuffer.length,
        hashSha256,
        estado: 'LISTO',
        resumen: acta.resumen,
        datosClave: JSON.stringify({ participantes: acta.participantes, fecha: acta.fecha }),
        textoExtraido: texto.slice(0, 8_000),
        creadoPor: actor,
        ...(proyectoId ? { proyectoId } : {}),
        ...(embedding.length > 0
          ? { embedding: `[${embedding.join(',')}]` }
          : {}),
      },
    });

    await logEvento({
      entidad: 'DOCUMENTO',
      entidadId: doc.id,
      accion: 'CREAR',
      actor,
      detalle: `Acta generada desde transcript (${texto.length} chars)`,
    });

    return NextResponse.json({ acta, documentoId: doc.id, docxBase64: archivoBase64 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const actas = await prisma.documento.findMany({
    where: { tipo: 'ACTA' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, nombre: true, resumen: true, estado: true, createdAt: true, proyectoId: true },
  });
  return NextResponse.json(actas);
}
