import chokidar from 'chokidar';
import { readFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { runSkill } from '@/lib/claudeCode';
import { logEvento } from '@/lib/auditoria';
import { escribirNota } from '@/lib/obsidian';

const INGESTA_BASE_PATH = process.env.INGESTA_BASE_PATH ?? '/tmp/ingesta';
const MAX_MB = Number(process.env.MAX_DOCUMENTO_MB ?? '15');
const DEBOUNCE_MS = 2_000;

const EXTENSIONES_TRANSCRIPT = /\.(txt|md)$/i;
const EXTENSIONES_ACEPTADAS = /\.(txt|md|pdf|doc|docx)$/i;

function esTranscript(filePath: string): boolean {
  const enCarpetaTactiq = filePath.toLowerCase().includes('tactiq') || filePath.toLowerCase().includes('transcripts');
  return enCarpetaTactiq && EXTENSIONES_TRANSCRIPT.test(filePath);
}

interface ClasificacionResult {
  tipo?: string;
  area?: string;
  resumen?: string;
  datosClave?: string;
  textoExtraido?: string;
}

export function startWatcher(): void {
  console.log(`[watcher] Vigilando ${INGESTA_BASE_PATH}`);

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = chokidar.watch(INGESTA_BASE_PATH, {
    ignored: [/(^|[/\\])\../, /Procesados[/\\]/],
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 1_500, pollInterval: 300 },
  });

  watcher.on('add', (filePath) => {
    if (!EXTENSIONES_ACEPTADAS.test(filePath)) return;
    const prev = timers.get(filePath);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      timers.delete(filePath);
      procesarArchivo(filePath).catch((err) =>
        console.error(`[watcher] Error en ${filePath}:`, err),
      );
    }, DEBOUNCE_MS);
    timers.set(filePath, timer);
  });

  watcher.on('error', (err) => console.error('[watcher] Error chokidar:', err));
}

async function procesarArchivo(filePath: string): Promise<void> {
  console.log(`[watcher] Detectado: ${filePath}`);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    console.error(`[watcher] No se pudo leer ${filePath}`);
    return;
  }

  const tamanoBytes = buffer.length;
  if (tamanoBytes > MAX_MB * 1_048_576) {
    console.warn(`[watcher] ${filePath} supera ${MAX_MB}MB`);
    return;
  }

  const hashSha256 = createHash('sha256').update(buffer).digest('hex');
  const nombre = basename(filePath);
  const origenCarpeta = dirname(filePath);
  const archivoBase64 = buffer.toString('base64');

  const existente = await prisma.documento.findUnique({ where: { hashSha256 } });
  if (existente) {
    console.warn(`[watcher] Duplicado ignorado: ${nombre}`);
    return;
  }

  let doc = await prisma.documento.create({
    data: {
      nombre,
      tipo: 'OTRO',
      origen: 'SUBIDO',
      origenCarpeta,
      archivoBase64,
      mimeType: inferMime(nombre),
      tamanoBytes,
      hashSha256,
      estado: 'PROCESANDO',
      creadoPor: 'watcher',
    },
  });

  await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'CREAR', actor: 'watcher', detalle: `Detectado en ${origenCarpeta}` });

  if (esTranscript(filePath)) {
    await procesarTranscript(filePath, buffer, doc);
    return;
  }

  try {
    const texto = buffer.toString('utf8').slice(0, 8_000);
    const input = JSON.stringify({ nombre, contenido: texto });
    const salida = await runSkill('clasificar-documento', input);

    let clasificacion: ClasificacionResult = {};
    try { clasificacion = JSON.parse(salida) as ClasificacionResult; }
    catch { clasificacion = { resumen: salida }; }

    const docListo = await prisma.documento.update({
      where: { id: doc.id },
      data: {
        tipo: clasificacion.tipo ?? 'OTRO',
        area: clasificacion.area ?? null,
        resumen: clasificacion.resumen ?? null,
        datosClave: clasificacion.datosClave ?? null,
        textoExtraido: clasificacion.textoExtraido ?? texto,
        estado: 'LISTO',
      },
      include: { proyecto: { select: { nombre: true } } },
    });
    doc = docListo;

    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'MODIFICAR', actor: 'watcher', detalle: 'Clasificado' });

    await escribirNota({ ...docListo, proyectoNombre: docListo.proyecto?.nombre ?? null }).catch((e) =>
      console.error('[watcher] Error escribiendo nota Obsidian:', e)
    );

    const destDir = join(origenCarpeta, 'Procesados');
    await mkdir(destDir, { recursive: true });
    await rename(filePath, join(destDir, nombre));
    console.log(`[watcher] Procesado: ${nombre}`);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await prisma.documento.update({ where: { id: doc.id }, data: { estado: 'ERROR' } });
    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'ERROR_PROCESAMIENTO', actor: 'watcher', detalle });
    console.error(`[watcher] Fallo: ${nombre}:`, err);
  }
}

async function procesarTranscript(filePath: string, buffer: Buffer, doc: { id: string }): Promise<void> {
  const nombre = basename(filePath);
  const origenCarpeta = dirname(filePath);
  const texto = buffer.toString('utf8');

  try {
    const { generarDocx } = await import('@/lib/docx');
    const { getEmbedding } = await import('@/lib/embeddings');

    const salidaRaw = await runSkill('generar-acta', texto.slice(0, 12_000));
    let acta: Record<string, unknown>;
    try {
      const jsonMatch = salidaRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : salidaRaw.trim();
      acta = JSON.parse(jsonStr) as Record<string, unknown>;
    } catch {
      acta = { titulo: nombre, fecha: new Date().toISOString().slice(0, 10), resumen: salidaRaw, participantes: [], puntosTratados: [], acuerdos: [], proximosPasos: [] };
    }

    const docxBuffer = await generarDocx(acta as never);
    const archivoBase64 = docxBuffer.toString('base64');
    const hashDocx = createHash('sha256').update(docxBuffer).digest('hex');

    const textoEmbedding = [acta.resumen ?? '', ...((acta.puntosTratados as string[]) ?? [])].join(' ');
    let embedding: number[] = [];
    try { embedding = await getEmbedding(textoEmbedding); } catch { /* silencioso */ }

    // Actualizar documento sin campo embedding
    await prisma.documento.update({
      where: { id: doc.id },
      data: {
        nombre: `${String(acta.titulo ?? 'Acta')} — ${String(acta.fecha ?? new Date().toISOString().slice(0, 10))}.docx`,
        tipo: 'ACTA',
        origen: 'GENERADO',
        archivoBase64,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        tamanoBytes: docxBuffer.length,
        hashSha256: hashDocx,
        estado: 'LISTO',
        resumen: acta.resumen ? String(acta.resumen) : null,
        datosClave: JSON.stringify({ participantes: acta.participantes, fecha: acta.fecha }),
        textoExtraido: texto.slice(0, 8_000),
      },
    });

    // Actualizar embedding con SQL raw (vector(1024) no soportado en Prisma Client)
    if (embedding.length > 0) {
      const vectorStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "Documento" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        doc.id,
      );
    }

    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'MODIFICAR', actor: 'watcher', detalle: `Acta generada: ${nombre}` });

    const docActualizado = await prisma.documento.findUnique({ where: { id: doc.id }, include: { proyecto: { select: { nombre: true } } } });
    if (docActualizado) {
      await escribirNota({ ...docActualizado, proyectoNombre: docActualizado.proyecto?.nombre ?? null }).catch((e) =>
        console.error('[watcher] Error escribiendo nota Obsidian (acta):', e)
      );
    }

    const destDir = join(origenCarpeta, 'Procesados');
    await mkdir(destDir, { recursive: true });
    await rename(filePath, join(destDir, nombre));
    console.log(`[watcher] Transcript procesado: ${nombre}`);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await prisma.documento.update({ where: { id: doc.id }, data: { estado: 'ERROR' } });
    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'ERROR_PROCESAMIENTO', actor: 'watcher', detalle });
    console.error(`[watcher] Fallo transcript ${nombre}:`, err);
  }
}

function inferMime(nombre: string): string {
  if (/\.pdf$/i.test(nombre)) return 'application/pdf';
  if (/\.docx$/i.test(nombre)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.doc$/i.test(nombre)) return 'application/msword';
  if (/\.md$/i.test(nombre)) return 'text/markdown';
  return 'text/plain';
}
