import chokidar from 'chokidar';
import { readFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { runSkill } from '@/lib/claudeCode';
import { logEvento } from '@/lib/auditoria';
import { escribirNota } from '@/lib/obsidian';

const INGESTA_BASE_PATH = process.env.INGESTA_BASE_PATH ?? '/tmp/ingesta';
const SILVER_BASE_PATH = process.env.SILVER_BASE_PATH ?? '/app/procesados';
const MAX_MB = Number(process.env.MAX_DOCUMENTO_MB ?? '15');
const DEBOUNCE_MS = 2_000;

const EXTENSIONES_TRANSCRIPT = /\.(txt|md)$/i;
const EXTENSIONES_ACEPTADAS = /\.(txt|md|pdf|doc|docx)$/i;

// Mapa de tipo legal → subcarpeta en Procesados
const TIPO_A_CARPETA: Record<string, string> = {
  CONTRATO:            'Contratos',
  ACTA:                'Actas',
  PODER:               'Poderes',
  DEMANDA:             'Demandas',
  FORMATO:             'Formatos',
  DOCUMENTACION_LEGAL: 'DocumentacionLegal',
  OTRO:                'Otros',
};

function esTranscript(filePath: string): boolean {
  const enCarpetaTactiq = filePath.toLowerCase().includes('tactiq') || filePath.toLowerCase().includes('transcripts');
  return enCarpetaTactiq && EXTENSIONES_TRANSCRIPT.test(filePath);
}

// Extrae el nombre del socio desde la ruta relativa a INGESTA_BASE_PATH
// /app/ingesta/SocioA/contratos/file.pdf → "SocioA"
// /app/ingesta/file.pdf → null (sin subcarpeta de socio)
function extraerSocio(filePath: string): string | null {
  const rel = relative(INGESTA_BASE_PATH, filePath);
  const partes = rel.split('/');
  if (partes.length > 1 && !partes[0].startsWith('Procesados')) {
    return partes[0];
  }
  return null;
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
    ignored: [/(^|[/\\])\../],
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
  const socio = extraerSocio(filePath);
  const archivoBase64 = buffer.toString('base64');

  // ── BRONZE: registrar recepción inmediatamente ──────────────────────────
  const bronzeExistente = await prisma.docBronze.findUnique({ where: { hashSha256 } });

  if (bronzeExistente) {
    const quien = bronzeExistente.socio ?? 'otro socio';
    console.warn(`[watcher] Duplicado detectado (hash ya existe, subido por ${quien}): ${nombre}`);
    await prisma.docBronze.update({
      where: { hashSha256 },
      data: { estado: 'DUPLICADO', detalle: `Recibido de nuevo desde ${socio ?? origenCarpeta}` },
    });
    return;
  }

  const bronze = await prisma.docBronze.create({
    data: {
      hashSha256,
      nombre,
      mimeType: inferMime(nombre),
      tamanoBytes,
      rutaFisica: filePath,
      socio,
      estado: 'RECIBIDO',
    },
  });
  console.log(`[watcher] Bronze registrado: ${nombre} (socio: ${socio ?? 'sin carpeta'})`);

  // Documento silver duplicado (por hash en Documento)
  const existente = await prisma.documento.findUnique({ where: { hashSha256 } });
  if (existente) {
    await prisma.docBronze.update({ where: { id: bronze.id }, data: { estado: 'DUPLICADO', detalle: `Ya existe como documento ${existente.id}` } });
    console.warn(`[watcher] Duplicado en Documento ignorado: ${nombre}`);
    return;
  }

  // ── SILVER: crear registro y procesar ──────────────────────────────────
  let doc = await prisma.documento.create({
    data: {
      bronzeId: bronze.id,
      socio,
      nombre,
      tipo: 'OTRO',
      origen: 'SUBIDO',
      origenCarpeta,
      archivoBase64,
      mimeType: inferMime(nombre),
      tamanoBytes,
      hashSha256,
      estado: 'PROCESANDO',
      creadoPor: socio ?? 'watcher',
    },
  });

  await logEvento({
    entidad: 'DOCUMENTO',
    entidadId: doc.id,
    accion: 'CREAR',
    actor: socio ?? 'watcher',
    detalle: `Detectado en ${origenCarpeta}`,
  });

  if (esTranscript(filePath)) {
    await procesarTranscript(filePath, buffer, doc);
    return;
  }

  try {
    const texto = buffer.toString('utf8').slice(0, 8_000);
    const input = JSON.stringify({ nombre, contenido: texto });
    const salida = await runSkill('clasificar-documento', input);

    let clasificacion: ClasificacionResult = {};
    const jsonMatchClas = salida.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStrClas = jsonMatchClas ? jsonMatchClas[1].trim() : salida.trim();
    try { clasificacion = JSON.parse(jsonStrClas) as ClasificacionResult; }
    catch { clasificacion = { resumen: salida }; }

    const tipoFinal = clasificacion.tipo ?? 'OTRO';
    const subcarpetaTipo = TIPO_A_CARPETA[tipoFinal] ?? 'Otros';
    const destDir = join(SILVER_BASE_PATH, subcarpetaTipo);
    await mkdir(destDir, { recursive: true });

    const docListo = await prisma.documento.update({
      where: { id: doc.id },
      data: {
        tipo: tipoFinal,
        area: clasificacion.area ?? null,
        resumen: clasificacion.resumen ?? null,
        datosClave: clasificacion.datosClave ?? null,
        textoExtraido: clasificacion.textoExtraido ?? texto,
        origenCarpeta: destDir,
        estado: 'LISTO',
      },
      include: { proyecto: { select: { nombre: true } } },
    });
    doc = docListo;

    // Actualizar bronze → ENVIADO_A_SILVER
    await prisma.docBronze.update({
      where: { id: bronze.id },
      data: { estado: 'ENVIADO_A_SILVER' },
    });

    await logEvento({
      entidad: 'DOCUMENTO',
      entidadId: doc.id,
      accion: 'MODIFICAR',
      actor: socio ?? 'watcher',
      detalle: `Clasificado como ${tipoFinal} · movido a Procesados/${subcarpetaTipo}`,
    });

    await escribirNota({ ...docListo, proyectoNombre: docListo.proyecto?.nombre ?? null }).catch((e) =>
      console.error('[watcher] Error escribiendo nota Obsidian:', e)
    );

    await rename(filePath, join(destDir, nombre));
    console.log(`[watcher] Procesado: ${nombre} → Silver/${subcarpetaTipo}/`);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await prisma.documento.update({ where: { id: doc.id }, data: { estado: 'ERROR' } });
    await prisma.docBronze.update({ where: { id: bronze.id }, data: { estado: 'ERROR_EXTRACCION', detalle } });
    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'ERROR_PROCESAMIENTO', actor: 'watcher', detalle });
    console.error(`[watcher] Fallo: ${nombre}:`, err);
  }
}

async function procesarTranscript(filePath: string, buffer: Buffer, doc: { id: string }): Promise<void> {
  const nombre = basename(filePath);
  const origenCarpeta = dirname(filePath);
  const texto = buffer.toString('utf8');
  const bronzeDoc = await prisma.documento.findUnique({ where: { id: doc.id }, select: { bronzeId: true } });

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

    if (embedding.length > 0) {
      const vectorStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "Documento" SET embedding = $1::vector WHERE id = $2`,
        vectorStr,
        doc.id,
      );
    }

    if (bronzeDoc?.bronzeId) {
      await prisma.docBronze.update({ where: { id: bronzeDoc.bronzeId }, data: { estado: 'ENVIADO_A_SILVER' } });
    }

    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'MODIFICAR', actor: 'watcher', detalle: `Acta generada: ${nombre}` });

    const docActualizado = await prisma.documento.findUnique({ where: { id: doc.id }, include: { proyecto: { select: { nombre: true } } } });
    if (docActualizado) {
      await escribirNota({ ...docActualizado, proyectoNombre: docActualizado.proyecto?.nombre ?? null }).catch((e) =>
        console.error('[watcher] Error escribiendo nota Obsidian (acta):', e)
      );
    }

    const destDir = join(SILVER_BASE_PATH, 'Actas');
    await mkdir(destDir, { recursive: true });
    await rename(filePath, join(destDir, nombre));
    console.log(`[watcher] Transcript procesado: ${nombre} → Procesados/Actas/`);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await prisma.documento.update({ where: { id: doc.id }, data: { estado: 'ERROR' } });
    if (bronzeDoc?.bronzeId) {
      await prisma.docBronze.update({ where: { id: bronzeDoc.bronzeId }, data: { estado: 'ERROR_EXTRACCION', detalle } });
    }
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
