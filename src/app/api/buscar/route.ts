import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from '@/lib/embeddings';

type ResultRow = {
  id: string;
  nombre: string;
  tipo: string;
  area: string | null;
  resumen: string | null;
  estado: string;
  creadoPor: string | null;
  createdAt: Date;
  proyectoId: string | null;
  similitud: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: string; limit?: number; proyectoId?: string };
    const { query, limit = 10, proyectoId } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Se requiere el campo "query"' }, { status: 400 });
    }

    const embedding = await getEmbedding(query.trim());
    if (embedding.length === 0) {
      return NextResponse.json({ error: 'No se pudo generar el embedding de la consulta' }, { status: 500 });
    }

    const vectorStr = `[${embedding.join(',')}]`;
    const limitN = Math.min(Math.max(1, limit), 20);

    const proyectoCondicion = proyectoId ? `AND "proyectoId" = '${proyectoId.replace(/'/g, "''")}'` : '';

    // Umbral mínimo de similitud — filtra resultados sin relación semántica real
    const MIN_SIMILITUD = 0.33;

    const sql = `
      SELECT
        id, nombre, tipo, area, resumen, estado,
        "creadoPor", "createdAt", "proyectoId",
        1 - (embedding <=> $1::vector) AS similitud
      FROM "Documento"
      WHERE estado != 'ARCHIVADO'
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= ${MIN_SIMILITUD}
        ${proyectoCondicion}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    const resultados = await prisma.$queryRawUnsafe<ResultRow[]>(sql, vectorStr, limitN);

    return NextResponse.json({
      query,
      total: resultados.length,
      resultados: resultados.map(r => ({
        ...r,
        similitud: Number(r.similitud),
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
