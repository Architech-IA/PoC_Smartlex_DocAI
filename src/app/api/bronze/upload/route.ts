import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_MB = Number(process.env.MAX_DOCUMENTO_MB ?? '15');
const MAX_BYTES = MAX_MB * 1_048_576;
const INGESTA_BASE_PATH = process.env.INGESTA_BASE_PATH ?? '/app/ingesta';
const EXTENSIONES_ACEPTADAS = /\.(pdf|doc|docx|txt|md)$/i;

// Guarda el archivo en BRONZE (/app/ingesta/) sin indexar ni clasificar.
// El watcher lo detecta y registra en docBronze.
// El procesamiento ocurre cuando el usuario presiona "Procesar en gestor".
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const archivo = formData.get('archivo') as File | null;

    if (!archivo) {
      return NextResponse.json({ error: 'Se requiere el campo "archivo"' }, { status: 400 });
    }

    if (!EXTENSIONES_ACEPTADAS.test(archivo.name)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 415 });
    }

    if (archivo.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el limite de ${MAX_MB}MB` },
        { status: 413 },
      );
    }

    const safeName = archivo.name.replace(/[^a-zA-Z0-9._\-\s]/g, '_');
    await mkdir(INGESTA_BASE_PATH, { recursive: true });
    const destPath = join(INGESTA_BASE_PATH, safeName);

    const buffer = Buffer.from(await archivo.arrayBuffer());
    await writeFile(destPath, buffer);

    return NextResponse.json({ nombre: safeName, ruta: destPath }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
