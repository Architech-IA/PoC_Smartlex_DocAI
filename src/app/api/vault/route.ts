import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? '';

export interface NodoVault {
  nombre: string;
  path: string;
  tipo: 'carpeta' | 'nota';
  hijos?: NodoVault[];
}

async function leerArbol(dirPath: string, relPath: string = ''): Promise<NodoVault[]> {
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch { return []; }

  const nodos: NodoVault[] = [];
  for (const e of entries) {
    const rel = relPath ? `${relPath}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const hijos = await leerArbol(join(dirPath, e.name), rel);
      nodos.push({ nombre: e.name, path: rel, tipo: 'carpeta', hijos });
    } else if (e.name.endsWith('.md')) {
      nodos.push({ nombre: e.name.replace(/\.md$/, ''), path: rel, tipo: 'nota' });
    }
  }
  return nodos.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'carpeta' ? -1 : 1;
    return a.nombre.localeCompare(b.nombre);
  });
}

export async function GET() {
  if (!VAULT_PATH) return NextResponse.json({ error: 'Vault no configurado' }, { status: 500 });
  const arbol = await leerArbol(VAULT_PATH);
  return NextResponse.json(arbol);
}
