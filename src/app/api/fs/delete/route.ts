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

export async function DELETE(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path') ?? '';
  if (!raw || !isAllowed(raw)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

  // Never delete a root directory
  if (getRoots().some(r => path.resolve(r) === path.resolve(raw))) {
    return NextResponse.json({ error: 'No se puede eliminar un directorio raíz' }, { status: 400 });
  }

  try {
    const stat = await fs.stat(raw);
    if (stat.isDirectory()) {
      await fs.rm(raw, { recursive: true });
    } else {
      await fs.unlink(raw);
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
