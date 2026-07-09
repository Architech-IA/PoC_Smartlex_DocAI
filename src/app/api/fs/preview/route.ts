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

const TEXT_EXTS = new Set(['.txt', '.md', '.log', '.csv', '.json', '.ts', '.js', '.py', '.sh', '.yaml', '.yml', '.env']);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path') ?? '';

  if (!raw || !isAllowed(raw)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const ext = path.extname(raw).toLowerCase();

  if (ext === '.pdf') {
    try {
      const buf = await fs.readFile(raw);
      return NextResponse.json({ type: 'pdf', base64: buf.toString('base64') });
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (TEXT_EXTS.has(ext)) {
    try {
      const content = await fs.readFile(raw, 'utf-8');
      const lines = content.split('\n').slice(0, 300).join('\n');
      return NextResponse.json({ type: 'text', content: lines });
    } catch (e: unknown) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ type: 'binary', message: 'Vista previa no disponible para este tipo de archivo.' }, { status: 415 });
}
