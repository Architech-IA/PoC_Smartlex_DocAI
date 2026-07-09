import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from '@/lib/embeddings';

// Sugiere el cliente más probable para un documento buscando en el historial gold
// por similitud semántica con otros docs ya asignados al mismo cliente
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const documentoId = searchParams.get('documentoId');
  if (!documentoId) return NextResponse.json({ error: 'documentoId requerido' }, { status: 400 });

  const doc = await prisma.documento.findUnique({
    where: { id: documentoId },
    select: { textoExtraido: true, resumen: true, datosClave: true, tipo: true, area: true },
  });
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });

  const texto = [doc.resumen ?? '', doc.datosClave ?? '', (doc.textoExtraido ?? '').slice(0, 1000)].join(' ').trim();
  if (!texto) return NextResponse.json({ sugerencias: [] });

  let embedding: number[];
  try {
    embedding = await getEmbedding(texto);
  } catch {
    return NextResponse.json({ sugerencias: [] });
  }

  const vectorStr = `[${embedding.join(',')}]`;

  // Buscar documentos gold con mayor similitud semántica y agrupar por cliente
  const resultados = await prisma.$queryRawUnsafe<{ clienteId: string; nombre: string; similitud: number }[]>(
    `SELECT g."clienteId", c.nombre, AVG(1 - (d.embedding <=> $1::vector)) AS similitud
     FROM "DocGold" g
     JOIN "Documento" d ON d.id = g."documentoId"
     JOIN "Cliente" c ON c.id = g."clienteId"
     WHERE d.embedding IS NOT NULL AND d.id != $2
     GROUP BY g."clienteId", c.nombre
     ORDER BY similitud DESC
     LIMIT 5`,
    vectorStr,
    documentoId,
  );

  return NextResponse.json({
    sugerencias: resultados.map(r => ({
      clienteId: r.clienteId,
      nombre: r.nombre,
      similitud: Number(r.similitud),
    })),
  });
}
