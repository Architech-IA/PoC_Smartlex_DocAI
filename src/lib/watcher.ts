import chokidar from 'chokidar';
import { readFile } from 'node:fs/promises';
import { basename, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const INGESTA_BASE_PATH = process.env.INGESTA_BASE_PATH ?? '/tmp/ingesta';
const MAX_MB = Number(process.env.MAX_DOCUMENTO_MB ?? '15');
const DEBOUNCE_MS = 2_000;
const EXTENSIONES_ACEPTADAS = /\.(txt|md|pdf|doc|docx)$/i;

// /app/ingesta/SocioA/contratos/file.pdf → "SocioA"
// /app/ingesta/file.pdf → null
function extraerSocio(filePath: string): string | null {
  const rel = relative(INGESTA_BASE_PATH, filePath);
  const partes = rel.split('/');
  if (partes.length > 1) return partes[0];
  return null;
}

function inferMime(nombre: string): string {
  if (/\.pdf$/i.test(nombre)) return 'application/pdf';
  if (/\.docx$/i.test(nombre)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (/\.doc$/i.test(nombre)) return 'application/msword';
  if (/\.md$/i.test(nombre)) return 'text/markdown';
  return 'text/plain';
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
      registrarEnBronze(filePath).catch((err) =>
        console.error(`[watcher] Error en ${filePath}:`, err),
      );
    }, DEBOUNCE_MS);
    timers.set(filePath, timer);
  });

  watcher.on('error', (err) => console.error('[watcher] Error chokidar:', err));
}

// Solo registra el archivo en docBronze — NO indexa, NO clasifica, NO mueve.
// El procesamiento ocurre cuando el usuario presiona "Procesar en gestor" en el Explorador
// o cuando la ETL automatica lo dispara, ambos via POST /api/documentos.
async function registrarEnBronze(filePath: string): Promise<void> {
  console.log(`[watcher] Detectado: ${filePath}`);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    console.error(`[watcher] No se pudo leer ${filePath}`);
    return;
  }

  if (buffer.length > MAX_MB * 1_048_576) {
    console.warn(`[watcher] ${filePath} supera ${MAX_MB}MB — ignorado`);
    return;
  }

  const hashSha256 = createHash('sha256').update(buffer).digest('hex');
  const nombre = basename(filePath);
  const socio = extraerSocio(filePath);

  // Si ya esta en docBronze, no duplicar
  const bronzeExistente = await prisma.docBronze.findUnique({ where: { hashSha256 } });
  if (bronzeExistente) {
    console.warn(`[watcher] Ya registrado en Bronze: ${nombre} — ignorado`);
    return;
  }

  await prisma.docBronze.create({
    data: {
      hashSha256,
      nombre,
      mimeType: inferMime(nombre),
      tamanoBytes: buffer.length,
      rutaFisica: filePath,
      socio,
      estado: 'RECIBIDO',
    },
  });

  console.log(`[watcher] Bronze registrado: ${nombre} (socio: ${socio ?? 'sin carpeta'}) — pendiente de procesamiento`);
}
