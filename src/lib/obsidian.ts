import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? '';

interface DocumentoObsidian {
  id: string;
  nombre: string;
  tipo: string;
  area?: string | null;
  resumen?: string | null;
  datosClave?: string | null;
  estado: string;
  creadoPor?: string | null;
  createdAt: Date | string;
  proyectoNombre?: string | null;
}

export async function escribirNota(doc: DocumentoObsidian): Promise<void> {
  if (!VAULT_PATH) {
    console.warn('[obsidian] OBSIDIAN_VAULT_PATH no configurado, omitiendo nota');
    return;
  }

  const fecha = new Date(doc.createdAt).toISOString().slice(0, 10);
  const slug = doc.nombre.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  const nombreArchivo = `${fecha}-${slug}.md`;
  const carpeta = join(VAULT_PATH, 'Documentos', doc.tipo);

  await mkdir(carpeta, { recursive: true });

  let datosClaveObj: Record<string, unknown> = {};
  try {
    if (doc.datosClave) datosClaveObj = JSON.parse(doc.datosClave) as Record<string, unknown>;
  } catch { /* ignorar */ }

  const datosClaveYaml = Object.entries(datosClaveObj)
    .map(([k, v]) => `  ${k}: "${String(v).replace(/"/g, "'")}"`)
    .join('\n');

  const wikilink = doc.proyectoNombre ? `\n- [[Proyecto - ${doc.proyectoNombre}]]` : '';
  const appUrl = `http://localhost:3000/documentos/${doc.id}`;

  const contenido = `---
tipo: ${doc.tipo.toLowerCase()}
area: ${doc.area ?? ''}
estado: ${doc.estado}
autor: ${doc.creadoPor ?? 'sistema'}
fecha: ${fecha}
fuente: smartlex-docai
app_url: "${appUrl}"
${datosClaveYaml ? `datos_clave:\n${datosClaveYaml}` : ''}
---

# ${doc.nombre}

## Resumen

${doc.resumen ?? '_Sin resumen disponible._'}

## Metadata

| Campo | Valor |
|-------|-------|
| Tipo | ${doc.tipo} |
| Área | ${doc.area ?? '—'} |
| Estado | ${doc.estado} |
| Procesado por | ${doc.creadoPor ?? '—'} |
| Fecha | ${fecha} |

## Links

- [Ver en SmartLex DocAI](${appUrl})${wikilink}
`;

  const rutaFinal = join(carpeta, nombreArchivo);
  await writeFile(rutaFinal, contenido, 'utf8');
  console.log(`[obsidian] Nota escrita: ${rutaFinal}`);
}
