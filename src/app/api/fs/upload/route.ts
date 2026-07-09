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
  const dir = req.nextUrl.searchParams.get('dir') ?? '';
  if (!dir || !isAllowed(dir)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  const form = await req.formData();
  const uploaded: string[] = [];

  for (const [, value] of form.entries()) {
    if (typeof value === 'string') continue;
    const file = value as File;
    const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._\-\s]/g, '_');
    const dest = path.join(dir, safeName);

    if (!isAllowed(dest)) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buffer);
    uploaded.push(safeName);
  }

  return NextResponse.json({ uploaded });
}
