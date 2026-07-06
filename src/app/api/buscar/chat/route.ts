import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEmbedding } from '@/lib/embeddings';
import { runSkill } from '@/lib/claudeCode';
import { logEvento } from '@/lib/auditoria';

type DocRow = {
  id: string;
  nombre: string;
  tipo: string;
  area: string | null;
  resumen: string | null;
  textoExtraido: string | null;
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
    const { pregunta, actor = 'sistema', proyectoId, limitDocs = 5 } = body;

    if (!pregunta || pregunta.trim().length === 0) {
      return NextResponse.json({ error: 'Se requiere el campo "pregunta"' }, { status: 400 });
    }

    // 1. Embedding de la pregunta
    const embedding = await getEmbedding(pregunta.trim());
    if (embedding.length === 0) {
      return NextResponse.json({ error: 'No se pudo generar el embedding de la pregunta' }, { status: 500 });
    }

    const vectorStr = `[${embedding.join(',')}]`;
    const limitN = Math.min(Math.max(1, limitDocs), 8);
    const proyectoCondicion = proyectoId ? `AND "proyectoId" = '${proyectoId.replace(/'/g, "''")}'` : '';

    // 2. Recuperar documentos más relevantes por similitud semántica
    const docs = await prisma.$queryRawUnsafe<DocRow[]>(`
      SELECT id, nombre, tipo, area, resumen, "textoExtraido"
      FROM "Documento"
      WHERE estado != 'ARCHIVADO'
        AND embedding IS NOT NULL
        ${proyectoCondicion}
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `, vectorStr, limitN);

    if (docs.length === 0) {
      return NextResponse.json({
        pregunta,
        respuesta: 'No encontré documentos relevantes en el acervo para responder esta pregunta.',
        fuentes: [],
        confianza: 'BAJA',
        documentosConsultados: 0,
      });
    }

    // 3. Construir input para la Skill
    const inputSkill = JSON.stringify({
      pregunta: pregunta.trim(),
      documentos: docs.map(d => ({
        id: d.id,
        nombre: d.nombre,
        tipo: d.tipo,
        area: d.area ?? '',
        resumen: d.resumen ?? '',
        fragmento: (d.textoExtraido ?? d.resumen ?? '').slice(0, 1_500),
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
      resultado = {
        respuesta: salidaRaw.slice(0, 1_000),
        fuentes: [],
        confianza: 'BAJA',
      };
    }

    // 5. Registrar evento VER en cada documento consultado
    await Promise.all(
      docs.map(d =>
        logEvento({
          entidad: 'DOCUMENTO',
          entidadId: d.id,
          accion: 'VER',
          actor,
          detalle: `Consultado en búsqueda semántica: "${pregunta.slice(0, 80)}"`,
        }),
      ),
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
