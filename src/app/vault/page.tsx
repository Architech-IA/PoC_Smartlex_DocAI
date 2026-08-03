'use client';

import Link from 'next/link';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import GestorLayout from '@/components/GestorLayout';

interface NodoVault {
  nombre: string;
  path: string;
  tipo: 'carpeta' | 'nota';
  hijos?: NodoVault[];
}

interface ResultadoBusqueda {
  path: string;
  nombre: string;
  snippet: string;
  score: number;
}

// ─── Markdown renderer ──────────────────────────────────────────────────────

function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  if (!md.startsWith('---')) return { meta, body: md };
  const end = md.indexOf('\n---', 3);
  if (end === -1) return { meta, body: md };
  md.slice(3, end).trim().split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i > -1) {
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (k && v) meta[k] = v;
    }
  });
  return { meta, body: md.slice(end + 4).trim() };
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function inline(t: string): string {
  let s = esc(t);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/`(.+?)`/g, '<code class="mvd-code">$1</code>');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<span class="mvd-wikilink">$1</span>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="mvd-link">$1</a>');
  return s;
}

function renderMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  let tableHead = true;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const closeTable = () => { if (inTable) { out.push('</tbody></table></div>'); inTable = false; tableHead = true; } };

  for (const line of lines) {
    const trim = line.trim();
    if (/^---+$/.test(trim)) { closeList(); closeTable(); out.push('<hr class="mvd-hr">'); continue; }
    const hm = trim.match(/^(#{1,4})\s+(.+)/);
    if (hm) { closeList(); closeTable(); const n = hm[1].length; out.push(`<h${n} class="mvd-h${n}">${inline(hm[2])}</h${n}>`); continue; }
    if (trim.startsWith('|')) {
      const cells = trim.split('|').slice(1, -1).map(c => c.trim());
      if (cells.every(c => /^:?-+:?$/.test(c))) { tableHead = false; continue; }
      if (!inTable) { closeList(); out.push('<div class="mvd-table-wrap"><table class="mvd-table"><tbody>'); inTable = true; tableHead = true; }
      const tag = tableHead ? 'th' : 'td'; tableHead = false;
      out.push(`<tr>${cells.map(c => `<${tag} class="mvd-${tag}">${inline(c)}</${tag}>`).join('')}</tr>`);
      continue;
    }
    closeTable();
    const lm = line.match(/^(\s*[-*])\s+(.+)/);
    if (lm) { if (!inList) { out.push('<ul class="mvd-list">'); inList = true; } out.push(`<li class="mvd-li">${inline(lm[2])}</li>`); continue; }
    closeList();
    if (trim === '') { out.push('<div class="mvd-spacer"></div>'); continue; }
    out.push(`<p class="mvd-p">${inline(line)}</p>`);
  }
  closeList(); closeTable();
  return out.join('');
}

// ─── Tree ────────────────────────────────────────────────────────────────────

function countNotas(nodes: NodoVault[]): number {
  return nodes.reduce((s, n) => s + (n.tipo === 'nota' ? 1 : countNotas(n.hijos ?? [])), 0);
}

function nodeMatches(n: NodoVault, q: string): boolean {
  if (!q) return true;
  if (n.nombre.toLowerCase().includes(q)) return true;
  return (n.hijos ?? []).some(h => nodeMatches(h, q));
}

function TreeNode({ nodo, nivel, onSelect, selected, query }: {
  nodo: NodoVault; nivel: number; onSelect: (p: string) => void;
  selected: string | null; query: string;
}) {
  const [open, setOpen] = useState(nivel < 1);
  if (!nodeMatches(nodo, query.toLowerCase())) return null;
  if (nodo.tipo === 'carpeta') {
    return (
      <div>
        <button onClick={() => setOpen(o => !o)} className="vlt-folder" style={{ paddingLeft: 8 + nivel * 14 }}>
          <span className="vlt-chevron">{open ? '▾' : '▸'}</span>
          <span style={{ fontSize: '0.85em' }}>📁</span>
          <span style={{ flex: 1, textAlign: 'left' }}>{nodo.nombre}</span>
          <span className="vlt-count">{countNotas(nodo.hijos ?? [])}</span>
        </button>
        {open && (nodo.hijos ?? []).map(h => <TreeNode key={h.path} nodo={h} nivel={nivel + 1} onSelect={onSelect} selected={selected} query={query} />)}
      </div>
    );
  }
  const active = selected === nodo.path;
  return (
    <button onClick={() => onSelect(nodo.path)} className={`vlt-note${active ? ' vlt-note-on' : ''}`} style={{ paddingLeft: 8 + nivel * 14 }}>
      <span style={{ opacity: 0.45, fontSize: '0.78em' }}>📄</span>
      <span className="vlt-note-nm">{nodo.nombre}</span>
    </button>
  );
}

const EC: Record<string, string> = {
  activo: '#22c55e', pendiente: '#f59e0b', archivado: '#6b7280',
  borrador: '#a78bfa', revisado: '#60a5fa', firmado: '#34d399',
  listo: '#34d399', LISTO: '#34d399',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VaultPage() {
  const [arbol, setArbol] = useState<NodoVault[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [contenido, setContenido] = useState<string | null>(null);
  const [loadingNota, setLoadingNota] = useState(false);
  const [query, setQuery] = useState('');
  // Search mode
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ResultadoBusqueda[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mobile panel toggle: 'sidebar' | 'content'
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'content'>('sidebar');

  useEffect(() => {
    fetch('/api/vault').then(r => r.json()).then(setArbol).catch(() => {});
  }, []);

  const onSelect = useCallback(async (path: string) => {
    setSelected(path);
    setMobilePanel('content');
    setLoadingNota(true);
    try {
      const r = await fetch(`/api/vault/nota?path=${encodeURIComponent(path)}`);
      const d = await r.json();
      setContenido(d.contenido ?? null);
    } catch { setContenido(null); }
    finally { setLoadingNota(false); }
  }, []);

  // Debounced content search
  useEffect(() => {
    if (!searchMode || searchQuery.length < 2) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await fetch(`/api/vault/buscar?q=${encodeURIComponent(searchQuery)}`);
        const d = await r.json();
        setSearchResults(d.resultados ?? []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchMode, searchQuery]);

  const totalNotas = useMemo(() => countNotas(arbol), [arbol]);
  const parsed = useMemo(() => contenido ? parseFrontmatter(contenido) : null, [contenido]);
  const notaName = selected?.split('/').pop()?.replace(/\.md$/, '') ?? '';

  return (
    <GestorLayout>
      <style>{`
        .vlt-shell{display:flex;height:calc(100vh - 130px);border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:#0a1120}
        .vlt-sidebar{width:252px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.07);background:#070d1a}
        .vlt-content{flex:1;overflow-y:auto;padding:28px 30px;min-width:0}
        .vlt-tree{flex:1;overflow-y:auto;padding:4px 0}
        .vlt-folder{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;color:#64748b;cursor:pointer;font-size:0.73em;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding-top:5px;padding-bottom:5px;padding-right:8px;transition:color .15s}
        .vlt-folder:hover{color:#94a3b8}
        .vlt-chevron{font-size:.6em;width:10px;flex-shrink:0;color:#475569}
        .vlt-count{font-size:.7em;opacity:.4;font-weight:400;margin-left:auto}
        .vlt-note{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;border-left:2px solid transparent;color:#475569;cursor:pointer;font-size:.85em;text-align:left;padding-top:4px;padding-bottom:4px;padding-right:8px;transition:all .12s}
        .vlt-note:hover{color:#94a3b8;background:rgba(255,255,255,0.025)}
        .vlt-note-on{color:#c4b5fd!important;background:rgba(99,102,241,0.12)!important;border-left-color:#818cf8!important}
        .vlt-note-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .vlt-mode-btn{flex:1;padding:7px 0;background:none;border:none;font-size:.75em;font-weight:600;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:all .15s;border-bottom:2px solid transparent}
        .vlt-mode-on{color:#818cf8!important;border-bottom-color:#818cf8!important}
        .mvd-h1{font-size:1.55em;font-weight:800;margin:1.3em 0 .4em;color:#f1f5f9}
        .mvd-h2{font-size:1.22em;font-weight:700;margin:1.1em 0 .35em;color:#e2e8f0}
        .mvd-h3{font-size:1.07em;font-weight:600;margin:1em 0 .28em;color:#cbd5e1}
        .mvd-h4{font-size:.97em;font-weight:600;margin:.8em 0 .22em;color:#94a3b8}
        .mvd-p{margin:.3em 0;line-height:1.68;color:#94a3b8}
        .mvd-list{list-style:disc;padding-left:1.4em;margin:.4em 0}
        .mvd-li{margin:.2em 0;line-height:1.6;color:#94a3b8}
        .mvd-hr{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:1.2em 0}
        .mvd-spacer{height:.45em}
        .mvd-code{background:rgba(255,255,255,0.09);padding:1px 5px;border-radius:3px;font-size:.88em;font-family:monospace;color:#a5b4fc}
        .mvd-link{color:#60a5fa;text-decoration:underline}
        .mvd-wikilink{color:#818cf8;text-decoration:underline;cursor:pointer}
        .mvd-table-wrap{overflow-x:auto;margin:.8em 0;border-radius:6px;border:1px solid rgba(255,255,255,0.08)}
        .mvd-table{width:100%;border-collapse:collapse;font-size:.88em}
        .mvd-th{padding:8px 12px;background:rgba(99,102,241,0.1);font-weight:600;color:#c4b5fd;text-align:left;border-bottom:1px solid rgba(255,255,255,0.1)}
        .mvd-td{padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#94a3b8}
        .srch-card{padding:12px 14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);cursor:pointer;transition:all .15s;margin-bottom:8px}
        .srch-card:hover{background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3)}
        /* Mobile */
        .vlt-mobile-bar{display:none;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;background:#070d1a}
        @media(max-width:767px){
          .vlt-shell{flex-direction:column;height:auto;min-height:calc(100vh - 160px);border-radius:8px}
          .vlt-mobile-bar{display:flex}
          .vlt-sidebar{width:100%;border-right:none;border-bottom:1px solid rgba(255,255,255,0.07);display:var(--vlt-sidebar-display,flex)}
          .vlt-content{display:var(--vlt-content-display,none);padding:18px 16px}
        }
      `}</style>
      <style>{`
        :root{
          --vlt-sidebar-display:${mobilePanel === 'sidebar' ? 'flex' : 'none'};
          --vlt-content-display:${mobilePanel === 'content' ? 'block' : 'none'};
        }
      `}</style>

      {/* Mobile panel switcher */}
      <div className="vlt-mobile-bar">
        <button className={`vlt-mode-btn${mobilePanel === 'sidebar' ? ' vlt-mode-on' : ''}`} style={{ color: '#64748b' }} onClick={() => setMobilePanel('sidebar')}>📂 Explorador</button>
        <button className={`vlt-mode-btn${mobilePanel === 'content' ? ' vlt-mode-on' : ''}`} style={{ color: '#64748b' }} onClick={() => setMobilePanel('content')}>📄 Nota</button>
      </div>

      <div className="vlt-shell">
        {/* Sidebar */}
        <div className="vlt-sidebar">
          {/* Header */}
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: '.88em', color: '#818cf8', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🧠</span> Vault
            </div>
            <div style={{ fontSize: '.7em', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{totalNotas} notas · {arbol.length} carpetas</span>
              <Link href="/vault/grafo" style={{ color: '#818cf8', fontSize: '.85em', textDecoration: 'none', opacity: .7 }} title="Ver grafo">🕸</Link>
            </div>
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button className={`vlt-mode-btn${!searchMode ? ' vlt-mode-on' : ''}`} style={{ color: '#475569' }} onClick={() => setSearchMode(false)}>🗂 Árbol</button>
            <button className={`vlt-mode-btn${searchMode ? ' vlt-mode-on' : ''}`} style={{ color: '#475569' }} onClick={() => setSearchMode(true)}>🔍 Buscar</button>
          </div>

          {!searchMode ? (
            <>
              <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar por nombre…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 9px', color: '#94a3b8', fontSize: '.8em', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div className="vlt-tree">
                {arbol.length === 0 && <div style={{ padding: '16px 14px', color: '#334155', fontSize: '.8em' }}>Cargando…</div>}
                {arbol.map(n => <TreeNode key={n.path} nodo={n} nivel={0} onSelect={onSelect} selected={selected} query={query} />)}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar en contenido…" autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 9px', color: '#94a3b8', fontSize: '.8em', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div className="vlt-tree">
                {searchLoading && <div style={{ padding: '14px', color: '#475569', fontSize: '.8em' }}>Buscando…</div>}
                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div style={{ padding: '14px', color: '#334155', fontSize: '.8em' }}>Sin resultados para "{searchQuery}"</div>
                )}
                {searchResults.map(r => (
                  <button key={r.path} onClick={() => onSelect(r.path)} className={`vlt-note${selected === r.path ? ' vlt-note-on' : ''}`} style={{ paddingLeft: 8, paddingRight: 8, flexDirection: 'column', alignItems: 'flex-start', height: 'auto', paddingTop: 8, paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <span style={{ opacity: 0.45, fontSize: '.75em', flexShrink: 0 }}>📄</span>
                      <span className="vlt-note-nm" style={{ fontWeight: 600 }}>{r.nombre}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '.65em', opacity: .4, flexShrink: 0 }}>{r.score}x</span>
                    </div>
                    <div style={{ fontSize: '.73em', color: '#334155', lineHeight: 1.4, marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {r.snippet}
                    </div>
                  </button>
                ))}
                {!searchLoading && searchQuery.length < 2 && (
                  <div style={{ padding: '14px', color: '#334155', fontSize: '.78em' }}>Escribí al menos 2 caracteres para buscar en el contenido de las notas.</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="vlt-content">
          {!selected && (
            <div style={{ textAlign: 'center', marginTop: 80, color: '#1e293b' }}>
              <div style={{ fontSize: '3.5em', marginBottom: 14 }}>🧠</div>
              <div style={{ fontSize: '1em', fontWeight: 600, marginBottom: 6, color: '#334155' }}>Segundo Cerebro</div>
              <div style={{ fontSize: '.82em', color: '#1e293b' }}>{totalNotas} notas — seleccioná una del árbol</div>
              <Link href="/vault/grafo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontSize: '.78em', color: '#818cf8', textDecoration: 'none', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(129,140,248,0.3)', background: 'rgba(129,140,248,0.08)' }}>🕸 Ver grafo de conexiones</Link>
            </div>
          )}
          {loadingNota && <div style={{ textAlign: 'center', marginTop: 80, color: '#334155', fontSize: '.9em' }}>Cargando…</div>}
          {!loadingNota && parsed && (
            <div style={{ maxWidth: 760 }}>
              <h1 style={{ fontSize: '1.6em', fontWeight: 800, color: '#f1f5f9', margin: '0 0 14px', lineHeight: 1.2 }}>{notaName}</h1>
              {Object.keys(parsed.meta).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {Object.entries(parsed.meta).map(([k, v]) => {
                    const c = k === 'estado' ? (EC[v] ?? EC[v.toLowerCase()] ?? '#94a3b8') : '#818cf8';
                    return (
                      <span key={k} style={{ fontSize: '.72em', padding: '3px 10px', borderRadius: 999, background: c + '1a', color: c, border: '1px solid ' + c + '40' }}>
                        <span style={{ opacity: .5 }}>{k}: </span>{v}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Link to real doc if app_url present */}
              {parsed.meta.app_url && (
                <a href={parsed.meta.app_url} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.78em', color: '#818cf8', textDecoration: 'none', marginBottom: 20, padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)' }}>
                  <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  Ver documento en la app
                </a>
              )}
              <div style={{ fontSize: '.91em' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(parsed.body) }} />
            </div>
          )}
        </div>
      </div>
    </GestorLayout>
  );
}
