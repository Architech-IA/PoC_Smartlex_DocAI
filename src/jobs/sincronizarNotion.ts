import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaginasModificadas } from '@/lib/notion';
import { runSkill } from '@/lib/claudeCode';
import { prisma } from '@/lib/prisma';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? '';
const TIMESTAMP_FILE = join(process.cwd(), 'data', 'notion-sync-ts.txt');
const CARPETA_EXPEDIENTES = join(VAULT_PATH, 'Expedientes-Notion');

async function leerUltimoTimestamp(): Promise<Date> {
  try {
    const raw = await readFile(TIMESTAMP_FILE, 'utf8');
    return new Date(raw.trim());
  } catch {
    // Primera vez: sincronizar los últimos 30 días
    return new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
  }
}

async function guardarTimestamp(fecha: Date): Promise<void> {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(TIMESTAMP_FILE, fecha.toISOString(), 'utf8');
}

async function encontrarProyectoPorNotionId(notionPageId: string): Promise<string | null> {
  try {
    const proyecto = await prisma.proyecto.findFirst({
      where: { notionPageId },
      select: { nombre: true },
    });
    return proyecto?.nombre ?? null;
  } catch {
    return null;
  }
}

export async function sincronizarNotion(): Promise<void> {
  if (!VAULT_PATH) {
    console.warn('[sincronizarNotion] OBSIDIAN_VAULT_PATH no configurado');
    return;
  }

  const desde = await leerUltimoTimestamp();
  console.log(`[sincronizarNotion] Buscando páginas modificadas desde ${desde.toISOString()}`);

  const paginas = await getPaginasModificadas(desde);
  console.log(`[sincronizarNotion] ${paginas.length} páginas para procesar`);

  if (paginas.length === 0) {
    await guardarTimestamp(new Date());
    return;
  }

  await mkdir(CARPETA_EXPEDIENTES, { recursive: true });

  for (const pagina of paginas) {
    try {
      const proyectoNombre = await encontrarProyectoPorNotionId(pagina.id);

      const input = JSON.stringify({
        titulo: pagina.titulo,
        contenido: pagina.contenido.slice(0, 10_000),
        proyecto: proyectoNombre ?? '',
        url: pagina.url,
      });

      const notaMd = await runSkill('sintetizar-notion', input);

      const fecha = pagina.ultimaEdicion.toISOString().slice(0, 10);
      const slug = pagina.titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
      const nombreArchivo = `${fecha}-${slug}.md`;
      const rutaFinal = join(CARPETA_EXPEDIENTES, nombreArchivo);

      await writeFile(rutaFinal, notaMd, 'utf8');
      console.log(`[sincronizarNotion] Nota escrita: ${nombreArchivo}`);
    } catch (err) {
      console.error(`[sincronizarNotion] Error procesando "${pagina.titulo}":`, err);
    }
  }

  await guardarTimestamp(new Date());
  console.log(`[sincronizarNotion] Sincronización completada. ${paginas.length} notas procesadas.`);
}
