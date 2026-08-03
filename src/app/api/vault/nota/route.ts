import { readFile } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? '';

export async function GET(req: NextRequest) {
  if (!VAULT_PATH) return NextResponse.json({ error: 'Vault no configurado' }, { status: 500 });

  const notaPath = req.nextUrl.searchParams.get('path');
  if (!notaPath) return NextResponse.json({ error: 'Parámetro path requerido' }, { status: 400 });

  // Path traversal protection
  const safe = resolve(join(VAULT_PATH, notaPath));
  if (!safe.startsWith(resolve(VAULT_PATH))) {
    return NextResponse.json({ error: 'Ruta no permitida' }, { status: 403 });
  }

  const filePath = safe.endsWith('.md') ? safe : safe + '.md';

  let contenido: string;
  try {
    contenido = await readFile(filePath, 'utf8');
  } catch {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ contenido, path: notaPath });
}
