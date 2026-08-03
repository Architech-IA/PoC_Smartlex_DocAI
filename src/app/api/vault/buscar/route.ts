import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? '';
const MAX_RESULTS = 30;
const SNIPPET_LEN = 120;

export interface ResultadoBusqueda {
  path: string;
  nombre: string;
  snippet: string;
  score: number;
}

async function buscarEnArchivos(
  dirPath: string,
  query: string,
  results: ResultadoBusqueda[],
) {
  if (results.length >= MAX_RESULTS) return;
  let entries;
  try { entries = await readdir(dirPath, { withFileTypes: true }); } catch { return; }

  for (const e of entries) {
    if (results.length >= MAX_RESULTS) break;
    const fullPath = join(dirPath, e.name);
    if (e.isDirectory()) {
      await buscarEnArchivos(fullPath, query, results);
    } else if (e.name.endsWith('.md')) {
      let text: string;
      try { text = await readFile(fullPath, 'utf8'); } catch { continue; }

      const lower = text.toLowerCase();
      const q = query.toLowerCase();
      const idx = lower.indexOf(q);
      if (idx === -1) continue;

      // count occurrences for score
      let count = 0;
      let pos = 0;
      while ((pos = lower.indexOf(q, pos)) !== -1) { count++; pos++; }

      // extract snippet around first match
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + SNIPPET_LEN);
      let snippet = text.slice(start, end).replace(/\n/g, ' ').trim();
      if (start > 0) snippet = '…' + snippet;
      if (end < text.length) snippet = snippet + '…';

      // remove frontmatter from snippet if it appears at the start
      if (snippet.startsWith('---')) {
        const fmEnd = snippet.indexOf('---', 3);
        if (fmEnd !== -1) snippet = snippet.slice(fmEnd + 3).trim() || snippet;
      }

      const relPath = relative(VAULT_PATH, fullPath);
      results.push({
        path: relPath,
        nombre: e.name.replace(/\.md$/, ''),
        snippet,
        score: count,
      });
    }
  }
}

export async function GET(req: NextRequest) {
  if (!VAULT_PATH) return NextResponse.json({ error: 'Vault no configurado' }, { status: 500 });

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ error: 'Query muy corta' }, { status: 400 });

  const safe = resolve(VAULT_PATH);
  const resultados: ResultadoBusqueda[] = [];
  await buscarEnArchivos(safe, q, resultados);

  resultados.sort((a, b) => b.score - a.score);

  return NextResponse.json({ q, total: resultados.length, resultados });
}
