import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

function getRoots(): string[] {
  return (process.env.FS_EXPLORER_ROOTS ?? '').split(',').map(r => r.trim()).filter(Boolean);
}
function isAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  return getRoots().some(root => resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep));
}

export async function POST(req: NextRequest) {
  const { from, toDir } = await req.json() as { from: string; toDir: string };
  if (!from || !toDir) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  if (!isAllowed(from) || !isAllowed(toDir)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  const dest = path.join(toDir, path.basename(from));
  if (!isAllowed(dest)) return NextResponse.json({ error: 'Destino no permitido' }, { status: 403 });

  try {
    await fs.rename(from, dest);
    return NextResponse.json({ ok: true, dest });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
