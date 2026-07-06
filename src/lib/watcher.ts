/**
 * Watcher de carpeta de ingesta.
 * Detecta archivos nuevos con chokidar, los procesa con runSkill('clasificar-documento')
 * y los mueve a Procesados/ al terminar (modelo Bronze → Silver).
 *
 * Para activar: importar e invocar startWatcher() desde un entry point (ej. un script separado
 * o desde src/app/api/watcher/start/route.ts). No corre dentro del proceso de Next.js por defecto.
 */

import chokidar from 'chokidar';
import { readFile, mkdir, rename } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { runSkill } from '@/lib/claudeCode';
import { logEvento } from '@/lib/auditoria';

const INGESTA_BASE_PATH = process.env.INGESTA_BASE_PATH ?? '/tmp/ingesta';
const MAX_MB = Number(process.env.MAX_DOCUMENTO_MB ?? '15');
const DEBOUNCE_MS = 2_000;

// Tipos de archivo que procesa el watcher (excluye el directorio Procesados/ mismo)
const EXTENSIONES_ACEPTADAS = /\.(txt|md|pdf|doc|docx)$/i;

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
    ignored: [
      /(^|[/\\])\../, // archivos ocultos
      /Procesados[/\\]/,  // no re-procesar los ya movidos
    ],
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 1_500, pollInterval: 300 },
  });

  watcher.on('add', (filePath) => {
    if (!EXTENSIONES_ACEPTADAS.test(filePath)) return;

    // Debounce: si el archivo cambia varias veces seguidas, esperar a que se estabilice
    const prev = timers.get(filePath);
    if (prev) clearTimeout(prev);

    const timer = setTimeout(() => {
      timers.delete(filePath);
      procesarArchivo(filePath).catch((err) =>
        console.error(`[watcher] Error inesperado en ${filePath}:`, err),
      );
    }, DEBOUNCE_MS);

    timers.set(filePath, timer);
  });

  watcher.on('error', (err) => console.error('[watcher] Error de chokidar:', err));
}

async function procesarArchivo(filePath: string): Promise<void> {
  console.log(`[watcher] Detectado: ${filePath}`);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    console.error(`[watcher] No se pudo leer ${filePath} — puede haber sido movido`);
    return;
  }

  // Validar tamaño
  const tamanoBytes = buffer.length;
  if (tamanoBytes > MAX_MB * 1_048_576) {
    console.warn(`[watcher] ${filePath} supera ${MAX_MB}MB — ignorado`);
    return;
  }

  const hashSha256 = createHash('sha256').update(buffer).digest('hex');
  const nombre = basename(filePath);
  const origenCarpeta = dirname(filePath);
  const archivoBase64 = buffer.toString('base64');

  // Detectar duplicado exacto
  const existente = await prisma.documento.findUnique({ where: { hashSha256 } });
  if (existente) {
    console.warn(`[watcher] Duplicado exacto ignorado: ${nombre} (existe id=${existente.id})`);
    return;
  }

  // Crear fila en PROCESANDO
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

  await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'CREAR', actor: 'watcher', detalle: `Detectado por watcher en ${origenCarpeta}` });

  // Encolar Skill de clasificación
  try {
    const texto = buffer.toString('utf8').slice(0, 8_000); // primeros 8k chars al modelo
    const input = JSON.stringify({ nombre, contenido: texto });
    const salida = await runSkill('clasificar-documento', input);

    let clasificacion: ClasificacionResult = {};
    try {
      clasificacion = JSON.parse(salida) as ClasificacionResult;
    } catch {
      clasificacion = { resumen: salida };
    }

    doc = await prisma.documento.update({
      where: { id: doc.id },
      data: {
        tipo: clasificacion.tipo ?? 'OTRO',
        area: clasificacion.area ?? null,
        resumen: clasificacion.resumen ?? null,
        datosClave: clasificacion.datosClave ?? null,
        textoExtraido: clasificacion.textoExtraido ?? texto,
        estado: 'LISTO',
      },
    });

    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'MODIFICAR', actor: 'watcher', detalle: 'Clasificado correctamente' });

    // Mover archivo a Procesados/
    const destDir = join(origenCarpeta, 'Procesados');
    await mkdir(destDir, { recursive: true });
    await rename(filePath, join(destDir, nombre));
    console.log(`[watcher] Procesado y movido a Procesados/: ${nombre}`);
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await prisma.documento.update({ where: { id: doc.id }, data: { estado: 'ERROR' } });
    await logEvento({ entidad: 'DOCUMENTO', entidadId: doc.id, accion: 'ERROR_PROCESAMIENTO', actor: 'watcher', detalle });
    console.error(`[watcher] Fallo clasificando ${nombre}:`, err);
  }
}

function inferMime(nombre: string): string {
  if (/\.pdf$/i.test(nombre)) return 'application/pdf';
  if (/\.docx$/i.test(nombre)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.doc$/i.test(nombre)) return 'application/msword';
  if (/\.md$/i.test(nombre)) return 'text/markdown';
  return 'text/plain';
}
