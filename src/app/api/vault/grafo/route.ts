import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // All documents that have chunks (=processed, have embeddings)
    const docIds = await prisma.$queryRaw<{ doc_id: string }[]>`
      SELECT DISTINCT "documentoId" as doc_id FROM "DocumentoChunk" WHERE embedding IS NOT NULL
    `;
    const ids = docIds.map(r => r.doc_id);

    const [docs, edges, goldMap] = await Promise.all([
      prisma.documento.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true, tipo: true, area: true, estado: true, createdAt: true },
      }),
      prisma.grafoEdge.findMany({
        where: { sourceId: { in: ids }, targetId: { in: ids } },
        select: { sourceId: true, targetId: true, score: true, tipo: true },
      }),
      // Get client assignments
      prisma.docGold.findMany({
        where: { documentoId: { in: ids } },
        select: { documentoId: true, cliente: { select: { nombre: true } } },
      }),
    ]);

    const clienteMap = new Map(goldMap.map(g => [g.documentoId, g.cliente.nombre]));

    const nodes = docs.map(d => ({
      id: d.id,
      label: d.nombre.replace(/\.[^.]+$/, '').slice(0, 60),
      tipo: d.tipo,
      area: d.area ?? 'Sin área',
      estado: d.estado,
      cliente: clienteMap.get(d.id) ?? null,
      createdAt: d.createdAt,
    }));

    const edgeList = edges.map((e, i) => ({
      id: `e${i}`,
      source: e.sourceId,
      target: e.targetId,
      weight: e.score,
      tipo: e.tipo,
    }));

    const edgeCount = await prisma.grafoEdge.count();

    return NextResponse.json({
      nodes,
      edges: edgeList,
      totalNodes: nodes.length,
      totalEdges: edgeList.length,
      calculado: edgeCount > 0,
    });
  } catch (err) {
    console.error('[grafo/get]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
