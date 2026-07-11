import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from '@/lib/embeddings';

const CLASIFICADOR_URL = process.env.CLASIFICADOR_URL ?? 'http://host-gateway:3010';
const MIN_SIMILITUD = 0.28;

type ChunkRow = {
  chunkId: string;
  texto: string;
  indice: number;
  documentoId: string;
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

async function expandirQuery(query: string): Promise<string> {
  try {
    const res = await fetch(`${CLASIFICADOR_URL}/expandir-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return query;
    const data = await res.json() as { resultado?: string };
    const raw = data.resultado ?? '';
    const clean = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean) as { queryExpandida?: string };
    return parsed.queryExpandida?.trim() || query;
  } catch {
    return query;
  }
}

async function reranking(
  query: string,
  docs: { id: string; nombre: string; tipo: string; resumen: string | null; similitud: number }[]
): Promise<string[]> {
  try {
    const res = await fetch(`${CLASIFICADOR_URL}/reranking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, documentos: docs }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return docs.map(d => d.id);
    const data = await res.json() as { resultado?: string };
    const raw = data.resultado ?? '';
    const clean = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean) as { ordenIds?: string[] };
    if (Array.isArray(parsed.ordenIds) && parsed.ordenIds.length === docs.length) {
      return parsed.ordenIds;
    }
    return docs.map(d => d.id);
  } catch {
    return docs.map(d => d.id);
  }
}

function limpiarTexto(raw: string): string {
  let t = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  if (t.startsWith('{')) {
    try {
      const parsed = JSON.parse(t) as Record<string, unknown>;
      for (const f of ['textoExtraido', 'resumen', 'texto', 'contenido']) {
        if (typeof parsed[f] === 'string' && (parsed[f] as string).length > 20) {
          return parsed[f] as string;
        }
      }
    } catch (_e) { /* not JSON */ }
  }
  return t;
}

function extraerSnippet(texto: string, query: string, maxLen = 200): string {
  texto = limpiarTexto(texto);
  const palabras = query.toLowerCase().split(/\s+/).filter(p => p.length > 3);
  const words = texto.split(/\s+/);
  let mejorIdx = 0;
  let mejorScore = 0;
  for (let i = 0; i < words.length - 40; i++) {
    const ventana = words.slice(i, i + 40).join(' ').toLowerCase();
    const score = palabras.filter(p => ventana.includes(p)).length;
    if (score > mejorScore) { mejorScore = score; mejorIdx = i; }
  }
  if (mejorScore === 0) {
    const lower = texto.toLowerCase();
    for (const p of palabras) {
      const idx = lower.indexOf(p);
      if (idx >= 0) { mejorIdx = texto.slice(0, idx).split(/\s+/).length; break; }
    }
  }
  const snippet = words.slice(Math.max(0, mejorIdx - 5), mejorIdx + 45).join(' ');
  return snippet.length > maxLen ? snippet.slice(0, maxLen) + '…' : snippet;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: string; limit?: number; proyectoId?: string };
    const { query, limit = 10, proyectoId } = body;

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Se requiere el campo "query"' }, { status: 400 });
    }

    const queryOriginal = query.trim();
    const queryExpandida = await expandirQuery(queryOriginal);
    const embedding = await getEmbedding(queryExpandida);

    if (embedding.length === 0) {
      return NextResponse.json({ error: 'No se pudo generar el embedding' }, { status: 500 });
    }

    const vectorStr = `[${embedding.join(',')}]`;
    const limitN = Math.min(Math.max(1, limit), 20);
    const proyectoCond = proyectoId ? `AND d."proyectoId" = '${proyectoId.replace(/'/g, "''")}'` : '';

    const sql = `
      WITH chunk_scores AS (
        SELECT
          c.id AS "chunkId",
          c.texto,
          c.indice,
          d.id AS "documentoId",
          d.nombre,
          d.tipo,
          d.area,
          d.resumen,
          d.estado,
          d."creadoPor",
          d."createdAt",
          d."proyectoId",
          1 - (c.embedding <=> $1::vector) AS similitud_semantica,
          ts_rank(
            to_tsvector('simple', coalesce(c.texto,'') || ' ' || coalesce(d.nombre,'') || ' ' || coalesce(d.resumen,'')),
            plainto_tsquery('simple', $3)
          ) AS similitud_texto,
          -- Match exacto (insensible a mayúsculas): 1.0 si algún término de la query aparece literal
          CASE WHEN (
            lower(c.texto) LIKE '%' || lower($3) || '%'
            OR lower(d.nombre) LIKE '%' || lower($3) || '%'
            OR lower(coalesce(d.resumen,'')) LIKE '%' || lower($3) || '%'
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
          -- Scoring híbrido: semántico base + fulltext + bonus por match exacto
          -- Si hay match exacto, el score mínimo es 0.65 independientemente del embedding
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

    const rows = await (prisma.$queryRawUnsafe as (sql: string, ...vals: unknown[]) => Promise<ChunkRow[]>)(
      sql, vectorStr, limitN, queryOriginal
    );

    if (rows.length === 0) {
      return NextResponse.json({ query: queryOriginal, queryExpandida, total: 0, resultados: [] });
    }

    let ordenFinal = rows.map(r => r.documentoId);
    if (rows.length > 3) {
      const docsParaReranking = rows.map(r => ({
        id: r.documentoId,
        nombre: r.nombre,
        tipo: r.tipo,
        resumen: r.resumen,
        similitud: Number(r.similitud),
      }));
      ordenFinal = await reranking(queryOriginal, docsParaReranking);
    }

    const rowMap = new Map(rows.map(r => [r.documentoId, r]));
    const resultados = ordenFinal
      .map(id => rowMap.get(id))
      .filter(Boolean)
      .map(r => ({
        id: r!.documentoId,
        nombre: r!.nombre,
        tipo: r!.tipo,
        area: r!.area,
        resumen: r!.resumen,
        similitud: Number(r!.similitud),
        createdAt: r!.createdAt instanceof Date ? r!.createdAt.toISOString() : r!.createdAt,
        snippet: extraerSnippet(r!.texto, queryOriginal),
        chunkIndice: r!.indice,
      }));

    return NextResponse.json({
      query: queryOriginal,
      queryExpandida: queryExpandida !== queryOriginal ? queryExpandida : undefined,
      total: resultados.length,
      resultados,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
