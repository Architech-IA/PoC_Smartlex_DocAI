import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from '@/lib/embeddings';
import { runSkill } from '@/lib/claudeCode';
import { logEvento } from '@/lib/auditoria';

const MIN_SIMILITUD = 0.25;

type ChunkRow = {
  documentoId: string;
  nombre: string;
  tipo: string;
  area: string | null;
  resumen: string | null;
  textoExtraido: string | null;
  texto: string;
  similitud: number;
};

interface Fuente {
  id: string;
  nombre: string;
  cita: string;
}

interface RespuestaSkill {
  respuesta: string;
  fuentes: Fuente[];
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      pregunta?: string;
      actor?: string;
      proyectoId?: string;
      limitDocs?: number;
    };
    const { pregunta, actor = 'sistema', proyectoId, limitDocs = 6 } = body;

    if (!pregunta?.trim()) {
      return NextResponse.json({ error: 'Se requiere el campo "pregunta"' }, { status: 400 });
    }

    const preguntaClean = pregunta.trim();

    // 1. Embedding de la pregunta
    const embedding = await getEmbedding(preguntaClean);
    if (embedding.length === 0) {
      return NextResponse.json({ error: 'No se pudo generar el embedding' }, { status: 500 });
    }

    const vectorStr = `[${embedding.join(',')}]`;
    const limitN = Math.min(Math.max(1, limitDocs), 8);
    const proyectoCond = proyectoId ? `AND d."proyectoId" = '${proyectoId.replace(/'/g, "''")}'` : '';

    // 2. Búsqueda híbrida: chunk semántico + match exacto (igual que /api/buscar)
    const sql = `
      WITH chunk_scores AS (
        SELECT
          d.id AS "documentoId",
          d.nombre,
          d.tipo,
          d.area,
          d.resumen,
          d."textoExtraido",
          c.texto,
          1 - (c.embedding <=> $1::vector) AS similitud_semantica,
          ts_rank(
            to_tsvector('simple', coalesce(c.texto,'') || ' ' || coalesce(d.nombre,'') || ' ' || coalesce(d.resumen,'')),
            plainto_tsquery('simple', $3)
          ) AS similitud_texto,
          CASE WHEN (
            lower(c.texto) LIKE '%' || lower($3) || '%'
            OR lower(d.nombre) LIKE '%' || lower($3) || '%'
            OR lower(coalesce(d.resumen,'')) LIKE '%' || lower($3) || '%'
            OR lower(coalesce(d."textoExtraido",'')) LIKE '%' || lower($3) || '%'
          ) THEN 1.0 ELSE 0.0 END AS match_exacto
        FROM "DocumentoChunk" c
        JOIN "Documento" d ON d.id = c."documentoId"
        WHERE d.estado != 'ARCHIVADO'
          AND c.embedding IS NOT NULL
          ${proyectoCond}
      ),
      doc_best AS (
        SELECT DISTINCT ON ("documentoId")
          *,
          GREATEST(
            similitud_semantica * 0.55 + LEAST(similitud_texto * 3, 0.25) * 0.25 + match_exacto * 0.20,
            CASE WHEN match_exacto = 1.0 THEN 0.65 ELSE 0.0 END
          ) AS similitud
        FROM chunk_scores
        WHERE similitud_semantica >= ${MIN_SIMILITUD}
           OR match_exacto = 1.0
        ORDER BY "documentoId", (similitud_semantica + match_exacto) DESC
      )
      SELECT * FROM doc_best
      ORDER BY similitud DESC
      LIMIT $2
    `;

    const docs = await (prisma.$queryRawUnsafe as (sql: string, ...vals: unknown[]) => Promise<ChunkRow[]>)(
      sql, vectorStr, limitN, preguntaClean
    );

    if (docs.length === 0) {
      return NextResponse.json({
        pregunta,
        respuesta: 'No encontré documentos relevantes en el acervo para responder esta pregunta.',
        fuentes: [],
        confianza: 'BAJA',
        documentosConsultados: 0,
      });
    }

    // 3. Construir input para la Skill con el fragmento más relevante de cada doc
    const inputSkill = JSON.stringify({
      pregunta: preguntaClean,
      documentos: docs.map(d => ({
        id: d.documentoId,
        nombre: d.nombre,
        tipo: d.tipo,
        area: d.area ?? '',
        resumen: d.resumen ?? '',
        fragmento: (d.texto || d.textoExtraido || d.resumen || '').slice(0, 1_500),
      })),
    });

    // 4. Invocar Skill responder-pregunta
    const salidaRaw = await runSkill('responder-pregunta', inputSkill);

    let resultado: RespuestaSkill;
    try {
      const jsonMatch = salidaRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : salidaRaw.trim();
      resultado = JSON.parse(jsonStr) as RespuestaSkill;
    } catch {
      resultado = { respuesta: salidaRaw.slice(0, 1_000), fuentes: [], confianza: 'BAJA' };
    }

    // 5. Registrar auditoría
    await Promise.all(
      docs.map(d =>
        logEvento({
          entidad: 'DOCUMENTO',
          entidadId: d.documentoId,
          accion: 'VER',
          actor,
          detalle: `Chat: "${preguntaClean.slice(0, 80)}"`,
        })
      )
    );

    return NextResponse.json({
      pregunta,
      respuesta: resultado.respuesta,
      fuentes: resultado.fuentes ?? [],
      confianza: resultado.confianza ?? 'MEDIA',
      documentosConsultados: docs.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
