import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

function getRoots(): string[] {
  return (process.env.FS_EXPLORER_ROOTS ?? '').split(',').map(r => r.trim()).filter(Boolean);
}

function isAllowed(target: string): boolean {
  const resolved = path.resolve(target);
  return getRoots().some(root => resolved === path.resolve(root) || resolved.startsWith(path.resolve(root) + path.sep));
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('path') ?? '';

  if (!raw || !isAllowed(raw)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const ext = path.extname(raw).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';
    const filename = path.basename(raw);

    const stream = fs.createReadStream(raw);
    const nodeStream = stream as unknown as ReadableStream;
    return new NextResponse(nodeStream, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': 'attachment; filename="' + encodeURIComponent(filename) + '"',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
