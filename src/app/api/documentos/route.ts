import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runSkill } from '@/lib/claudeCode';
import { getEmbedding } from '@/lib/embeddings';
import { logEvento } from '@/lib/auditoria';
import { createHash } from 'node:crypto';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const MAX_MB = Number(process.env.MAX_DOCUMENTO_MB ?? '15');
const MAX_BYTES = MAX_MB * 1_048_576;
const SILVER_BASE_PATH = process.env.SILVER_BASE_PATH ?? '/app/procesados';
const TIPO_A_CARPETA: Record<string, string> = {
  CONTRATO:            'Contratos',
  ACTA:                'Actas',
  PODER:               'Poderes',
  DEMANDA:             'Demandas',
  FORMATO:             'Formatos',
  DOCUMENTACION_LEGAL: 'DocumentacionLegal',
  OTRO:                'Otros',
};

function inferMime(nombre: string): string {
  if (/\.pdf$/i.test(nombre)) return 'application/pdf';
  if (/\.docx$/i.test(nombre)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.doc$/i.test(nombre)) return 'application/msword';
  if (/\.md$/i.test(nombre)) return 'text/markdown';
  if (/\.txt$/i.test(nombre)) return 'text/plain';
  return 'application/octet-stream';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const archivo = formData.get('archivo') as File | null;
    const proyectoId = formData.get('proyectoId') as string | null;
    const actor = (formData.get('actor') as string | null) ?? 'sistema';
    const origenCarpeta = (formData.get('origenCarpeta') as string | null) ?? null;

    if (!archivo) {
      return NextResponse.json({ error: 'Se requiere el campo "archivo"' }, { status: 400 });
    }

    // Validar tamaño
    if (archivo.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${MAX_MB}MB (tamaño: ${(archivo.size / 1_048_576).toFixed(1)}MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const hashSha256 = createHash('sha256').update(buffer).digest('hex');
    const archivoBase64 = buffer.toString('base64');
    const mimeType = inferMime(archivo.name);

    // Verificar duplicado exacto
    const existente = await prisma.documento.findUnique({ where: { hashSha256 } });
    if (existente) {
      // Si ya existe pero falló, permitir reprocesamiento: resetear a PROCESANDO
      if (existente.estado === 'ERROR') {
        await prisma.documento.update({
          where: { id: existente.id },
          data: { estado: 'PROCESANDO', resumen: null, datosClave: null, textoExtraido: null },
        });
        clasificarDocumento(existente.id, buffer, archivo.name, actor).catch(() => {});
        return NextResponse.json({ documentoId: existente.id, estado: 'PROCESANDO', nombre: existente.nombre }, { status: 202 });
      }
      return NextResponse.json(
        { error: 'Archivo duplicado — ya existe un documento idéntico', documentoId: existente.id, nombre: existente.nombre },
        { status: 409 },
      );
    }

    // Crear registro en PROCESANDO
    const doc = await prisma.documento.create({
      data: {
        nombre: archivo.name,
        tipo: 'OTRO',
        origen: 'SUBIDO',
        origenCarpeta,
        archivoBase64,
        mimeType,
        tamanoBytes: archivo.size,
        hashSha256,
        estado: 'PROCESANDO',
        creadoPor: actor,
        ...(proyectoId ? { proyectoId } : {}),
      },
    });

    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'CREAR', actor, detalle: `Subido: ${archivo.name}` });

    // Clasificar con Skill (async — actualizamos el doc después)
    clasificarDocumento(doc.id, buffer, archivo.name, actor).catch(() => {});

    return NextResponse.json({ documentoId: doc.id, estado: 'PROCESANDO', nombre: archivo.name }, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function clasificarDocumento(
  docId: string,
  buffer: Buffer,
  nombre: string,
  actor: string,
): Promise<void> {
  try {
    let texto = '';
    try {
      if (/\.pdf$/i.test(nombre)) {
        const pdfData = await pdfParse(buffer);
        texto = (pdfData.text ?? '').slice(0, 8_000);
      } else {
        texto = buffer.toString('utf8').slice(0, 8_000);
      }
    } catch {
      texto = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').slice(0, 8_000);
    }
    const input = JSON.stringify({ nombre, contenido: texto });
    const salidaRaw = await runSkill('clasificar-documento', input);

    let clasificacion: {
      tipo?: string; area?: string; resumen?: string;
      datosClave?: string; textoExtraido?: string;
    } = {};
    try {
      const jsonMatch = salidaRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : salidaRaw.trim();
      clasificacion = JSON.parse(jsonStr);
    } catch {
      clasificacion = { resumen: salidaRaw.slice(0, 500) };
    }

    const textoParaEmbed = [clasificacion.resumen ?? '', texto].join(' ').slice(0, 4_000);
    let embedding: number[] = [];
    try { embedding = await getEmbedding(textoParaEmbed); } catch { /* silencioso */ }

    // Verificar similitud por embedding (sugerir versión si hay candidato similar)
    let similitudId: string | null = null;
    if (embedding.length > 0) {
      const candidatos = await prisma.$queryRaw<{ id: string; nombre: string; similitud: number }[]>`
        SELECT id, nombre, 1 - (embedding <=> ${`[${embedding.join(',')}]`}::vector) AS similitud
        FROM "Documento"
        WHERE estado != 'ARCHIVADO'
          AND id != ${docId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${`[${embedding.join(',')}]`}::vector
        LIMIT 1
      `;
      if (candidatos.length > 0 && candidatos[0].similitud > 0.92) {
        similitudId = candidatos[0].id;
      }
    }

    await prisma.documento.update({
      where: { id: docId },
      data: {
        tipo: clasificacion.tipo ?? 'OTRO',
        area: clasificacion.area ?? null,
        resumen: clasificacion.resumen ?? null,
        datosClave: clasificacion.datosClave ?? null,
        textoExtraido: clasificacion.textoExtraido ?? texto.slice(0, 8_000),
        estado: 'LISTO',
      },
    });

    if (embedding.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "Documento" SET embedding = $1::vector WHERE id = $2`,
        `[${embedding.join(',')}]`,
        docId,
      );
    }

    // Mover archivo físico a SILVER si viene de BRONZE (origenCarpeta conocida)
    const docParaMover = await prisma.documento.findUnique({ where: { id: docId }, select: { origenCarpeta: true, nombre: true, tipo: true } });
    if (docParaMover?.origenCarpeta && docParaMover.origenCarpeta.includes('ingesta')) {
      try {
        const tipoFinal = clasificacion.tipo ?? 'OTRO';
        const subcarpeta = TIPO_A_CARPETA[tipoFinal] ?? 'Otros';
        const destDir = join(SILVER_BASE_PATH, subcarpeta);
        await mkdir(destDir, { recursive: true });
        const srcPath = join(docParaMover.origenCarpeta, docParaMover.nombre);
        const destPath = join(destDir, docParaMover.nombre);
        await rename(srcPath, destPath).catch(() => {});
        await prisma.documento.update({ where: { id: docId }, data: { origenCarpeta: destDir } });
      } catch { /* silencioso si el archivo ya no existe */ }
    }

    const detalle = similitudId
      ? `Clasificado. Posible versión de doc ${similitudId}`
      : 'Clasificado correctamente';
    await logEvento({ entidad: 'DOCUMENTO', entidadId: docId, accion: 'MODIFICAR', actor, detalle });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await prisma.documento.update({ where: { id: docId }, data: { estado: 'ERROR' } }).catch(() => {});
    await logEvento({ entidad: 'DOCUMENTO', entidadId: docId, accion: 'ERROR_PROCESAMIENTO', actor, detalle });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const proyectoId = searchParams.get('proyectoId');
  const tipo = searchParams.get('tipo');
  const estado = searchParams.get('estado');
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);

  const docs = await prisma.documento.findMany({
    where: {
      ...(proyectoId ? { proyectoId } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado ? { estado } : { estado: { not: 'ARCHIVADO' } }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, nombre: true, tipo: true, area: true, estado: true,
      resumen: true, tamanoBytes: true, creadoPor: true, createdAt: true,
      proyectoId: true, origenCarpeta: true, versionNumero: true, esVersionActual: true,
    },
  });

  return NextResponse.json(docs);
}
