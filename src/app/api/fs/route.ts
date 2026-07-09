import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

function getRoots(): string[] {
  return (process.env.FS_EXPLORER_ROOTS ?? '')
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
}

function isAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  return getRoots().some(root => resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep));
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path') ?? '';

  if (!raw) {
    const roots = getRoots();
    return NextResponse.json({
      entries: roots.map(r => ({ name: path.basename(r), fullPath: r, type: 'dir', sizeBytes: 0, modifiedAt: null })),
    });
  }

  if (!isAllowed(raw)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const entries = await fs.readdir(raw, { withFileTypes: true });
    const result = await Promise.all(
      entries.map(async e => {
        const fullPath = path.join(raw, e.name);
        let sizeBytes = 0;
        let modifiedAt: string | null = null;
        try {
          const stat = await fs.stat(fullPath);
          sizeBytes = stat.size;
          modifiedAt = stat.mtime.toISOString();
        } catch { /* skip */ }
        return {
          name: e.name,
          fullPath,
          type: e.isDirectory() ? 'dir' : 'file',
          sizeBytes,
          modifiedAt,
          ext: e.isFile() ? path.extname(e.name).toLowerCase() : null,
        };
      })
    );
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return NextResponse.json({ path: raw, entries: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
