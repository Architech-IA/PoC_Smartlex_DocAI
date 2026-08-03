import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const K_NEIGHBORS = 6;
const MIN_SCORE = 0.25;

export async function POST() {
  try {
    // 1. Create HNSW index for future scale (safe if already exists)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
      ON "DocumentoChunk" USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // 2. Get one representative embedding per document (first chunk)
    const docEmbeds = await prisma.$queryRaw<{ doc_id: string }[]>`
      SELECT DISTINCT ON ("documentoId") "documentoId" as doc_id
      FROM "DocumentoChunk"
      WHERE embedding IS NOT NULL
      ORDER BY "documentoId", indice
    `;

    const docIds = docEmbeds.map(r => r.doc_id);
    if (docIds.length < 2) {
      return NextResponse.json({ error: 'Se necesitan al menos 2 documentos con embeddings' }, { status: 400 });
    }

    // 3. For each doc find K nearest neighbors using pgvector KNN
    const edgeMap = new Map<string, number>(); // "minId|||maxId" → max score
    let processed = 0;

    for (const sourceId of docIds) {
      const neighbors = await prisma.$queryRaw<{ target_id: string; score: number }[]>`
        WITH ref AS (
          SELECT embedding FROM "DocumentoChunk"
          WHERE "documentoId" = ${sourceId} AND embedding IS NOT NULL
          ORDER BY indice LIMIT 1
        )
        SELECT DISTINCT ON ("documentoId")
          "documentoId" as target_id,
          (1 - (dc.embedding <=> ref.embedding))::float as score
        FROM "DocumentoChunk" dc, ref
        WHERE dc."documentoId" != ${sourceId} AND dc.embedding IS NOT NULL
        ORDER BY "documentoId", dc.embedding <=> ref.embedding
        LIMIT ${K_NEIGHBORS}
      `;

      for (const { target_id, score } of neighbors) {
        if (score < MIN_SCORE) continue;
        const key = [sourceId, target_id].sort().join('|||');
        const prev = edgeMap.get(key) ?? 0;
        if (score > prev) edgeMap.set(key, score);
      }
      processed++;
    }

    // 4. Upsert all edges
    let upserted = 0;
    for (const [key, score] of edgeMap) {
      const [sourceId, targetId] = key.split('|||');
      await prisma.$executeRaw`
        INSERT INTO "GrafoEdge" (id, "sourceId", "targetId", score, tipo, "createdAt")
        VALUES (gen_random_uuid()::text, ${sourceId}, ${targetId}, ${score}, 'semantico', now())
        ON CONFLICT ("sourceId", "targetId") DO UPDATE SET score = EXCLUDED.score
      `;
      upserted++;
    }

    // 5. Also add metadata edges (mismo tipo + área)
    const docs = await prisma.documento.findMany({
      where: { id: { in: docIds }, estado: { not: 'ERROR' } },
      select: { id: true, tipo: true, area: true },
    });

    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const a = docs[i], b = docs[j];
        if (a.tipo === b.tipo && a.area && b.area && a.area === b.area) {
          const key = [a.id, b.id].sort().join('|||');
          if (!edgeMap.has(key)) {
            await prisma.$executeRaw`
              INSERT INTO "GrafoEdge" (id, "sourceId", "targetId", score, tipo, "createdAt")
              VALUES (gen_random_uuid()::text, ${a.id}, ${b.id}, 0.6, 'metadato', now())
              ON CONFLICT ("sourceId", "targetId") DO NOTHING
            `;
            upserted++;
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      documentosProcesados: processed,
      edgesCreados: upserted,
    });
  } catch (err) {
    console.error('[grafo/recalcular]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
