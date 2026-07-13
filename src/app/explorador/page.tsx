'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import GestorLayout from '@/components/GestorLayout';

interface Entry {
  name: string;
  fullPath: string;
  type: 'file' | 'dir';
  sizeBytes: number;
  modifiedAt: string | null;
  ext: string | null;
}

interface GoldInfo {
  id: string;
  clienteId: string;
  cliente: { nombre: string };
  expedienteId: string | null;
  expediente: { id: string; nombre: string; codigo: string | null; estado: string } | null;
  asignadoPor: string | null;
  asignadoEn: string;
  notas: string | null;
}

interface ClienteOpt {
  id: string;
  nombre: string;
  tipo: string;
}

interface ExpedienteOpt {
  id: string;
  nombre: string;
  codigo: string | null;
  estado: string;
  _count?: { gold: number };
}

interface GoldSugerencia {
  clienteId: string;
  nombre: string;
  similitud: number;
}

interface DocVersion {
  id: string;
  nombre: string;
  estado: string;
  tamanoBytes: number | null;
  creadoEn: string;
  resumen: string | null;
  tipo: string;
  area: string | null;
}

type ViewMode = 'list' | 'grid' | 'compact';
type SortField = 'name' | 'size' | 'modified' | 'type';
type SortDir = 'asc' | 'desc';
type DetailTab = 'info' | 'preview' | 'versions' | 'detalle' | 'auditoria';

const IMPORTABLE = new Set(['.pdf', '.doc', '.docx', '.txt', '.md']);
const PREVIEWABLE_TEXT = new Set(['.txt', '.md', '.log', '.csv', '.json', '.ts', '.js', '.py', '.sh', '.yaml', '.yml']);

const ROOT_LABELS: Record<string, string> = {
  '/app/ingesta': 'BRONZE',
  '/app/procesados': 'SILVER',
  '/app/vault': 'VAULT',
  '/app/gold': 'GOLD',
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  LISTO:      { label: 'Indexado',   color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: '✓' },
  PROCESANDO: { label: "Procesando", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  icon: "⏳" },
  EN_SILVER:  { label: "En SILVER",  color: "#818cf8", bg: "rgba(129,140,248,0.12)", icon: "→" },
  ERROR:      { label: 'Error',      color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: '✗' },
  ARCHIVADO:  { label: 'Archivado',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '📦' },
};

const GLASS = {
  background: 'rgba(4,4,14,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
};
const BRAND = '#f59e0b';
const BRAND_L = '#fbbf24';
const FONT = "'Inter', system-ui, sans-serif";

function formatBytes(b: number | null) {
  if (!b) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}
function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fileEmoji(ext: string | null) {
  const m: Record<string, string> = { '.pdf': '📄', '.doc': '📝', '.docx': '📝', '.txt': '📃', '.md': '📃', '.png': '🖼️', '.jpg': '🖼️', '.csv': '📊', '.json': '🔧', '.zip': '🗜️' };
  return ext && m[ext] ? m[ext] : '📎';
}

function StatusChip({ status }: { status?: string }) {
  if (!status) return null;
  const cfg = STATUS_CFG[status];
  if (!cfg) return null;
  return (
    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, fontWeight: 600, letterSpacing: '0.04em', flexShrink: 0, whiteSpace: 'nowrap' }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl overflow-hidden w-full max-w-md mx-4" style={{ ...GLASS, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-semibold text-white">{title}</p>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'rgba(148,163,184,0.7)', background: 'rgba(255,255,255,0.05)' }}>✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

type AuditoriaEvento = { id: string; accion: string; actor?: string; detalle?: string; createdAt: string };

const AUDITORIA_CFG: Record<string, { label: string; dot: string; badge: string; text: string }> = {
  VER:                  { label: 'VER',        dot: '#60a5fa', badge: 'rgba(55,138,221,0.15)',  text: '#60a5fa' },
  CREAR:                { label: 'CREAR',      dot: '#86efac', badge: 'rgba(99,153,34,0.15)',   text: '#86efac' },
  MODIFICAR:            { label: 'MODIFICAR',  dot: '#fbbf24', badge: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  ERROR:                { label: 'ERROR',      dot: '#f87171', badge: 'rgba(226,75,74,0.15)',   text: '#f87171' },
  ERROR_PROCESAMIENTO:  { label: 'ERROR',      dot: '#f87171', badge: 'rgba(226,75,74,0.15)',   text: '#f87171' },
  EXPORTAR:             { label: 'EXPORTAR',   dot: '#a78bfa', badge: 'rgba(129,140,248,0.15)', text: '#a78bfa' },
};
const AUDITORIA_DEFAULT = { label: 'ACCIÓN', dot: 'rgba(148,163,184,0.5)', badge: 'rgba(255,255,255,0.07)', text: '#94a3b8' };

function fmtAuditDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
function fmtAuditDay(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AuditoriaTimeline({ eventos, loading }: { eventos: AuditoriaEvento[]; loading: boolean }) {
  if (loading) return <p className="text-xs text-center mt-8" style={{ color: 'rgba(100,116,139,0.6)' }}>Cargando...</p>;
  if (!eventos.length) return <p className="text-xs text-center mt-8" style={{ color: 'rgba(100,116,139,0.5)' }}>Sin eventos registrados.</p>;

  // Agrupar por día
  const grupos: { dia: string; items: AuditoriaEvento[] }[] = [];
  for (const ev of eventos) {
    const dia = fmtAuditDay(ev.createdAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.items.push(ev);
    else grupos.push({ dia, items: [ev] });
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {grupos.map((grupo) => (
        <div key={grupo.dia} style={{ marginBottom: 16 }}>
          {/* Separador de día */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.55)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{grupo.dia}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>
          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: 22 }}>
            <div style={{ position: 'absolute', left: 6, top: 8, bottom: 8, width: 1, background: 'rgba(255,255,255,0.07)' }} />
            {grupo.items.map((ev) => {
              const cfg = AUDITORIA_CFG[ev.accion] ?? AUDITORIA_DEFAULT;
              return (
                <div key={ev.id} style={{ position: 'relative', marginBottom: 8 }}>
                  {/* Punto */}
                  <div style={{ position: 'absolute', left: -18, top: 13, width: 8, height: 8, borderRadius: '50%', background: cfg.dot, border: '2px solid #0a0a0a' }} />
                  {/* Tarjeta */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: cfg.badge, color: cfg.text }}>{cfg.label}</span>
                    </div>
                    {ev.detalle && <p style={{ fontSize: 11, color: 'rgba(203,213,225,0.7)', lineHeight: 1.45, marginBottom: 5 }}>{ev.detalle}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)' }}>{fmtAuditDate(ev.createdAt)}</span>
                      {ev.actor && (
                        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '1px 7px' }}>
                          {ev.actor === 'sistema' ? '⚙ sistema' : `👤 ${ev.actor}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}


const TIPO_BADGE: Record<string, { bg: string; color: string }> = {
  CONTRATO:            { bg: 'rgba(55,138,221,0.15)',  color: '#60a5fa' },
  ACTA:                { bg: 'rgba(99,153,34,0.15)',   color: '#86efac' },
  PODER:               { bg: 'rgba(129,140,248,0.15)', color: '#a78bfa' },
  DEMANDA:             { bg: 'rgba(226,75,74,0.15)',   color: '#f87171' },
  FORMATO:             { bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  DOCUMENTACION_LEGAL: { bg: 'rgba(20,184,166,0.15)', color: '#5eead4' },
  OUTRO:               { bg: 'rgba(255,255,255,0.07)', color: '#94a3b8' },
};
const ESTADO_BADGE: Record<string, { bg: string; color: string }> = {
  LISTO:      { bg: 'rgba(52,211,153,0.12)',  color: '#6ee7b7' },
  PROCESANDO: { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  ERROR:      { bg: 'rgba(226,75,74,0.12)',   color: '#f87171' },
  ARCHIVADO:  { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8' },
};

type DetalleDoc = {
  tipo: string; area?: string | null; estado: string;
  tamanoBytes?: number; creadoPor?: string | null;
  createdAt: string; updatedAt: string;
  resumen?: string | null; datosClave?: string | null;
};

function DetallePanelContent({ doc, loading, compact = false }: { doc: DetalleDoc | null; loading: boolean; compact?: boolean }) {
  if (loading) return <p style={{ fontSize: 12, textAlign: 'center', marginTop: 32, color: 'rgba(100,116,139,0.6)' }}>Cargando...</p>;
  if (!doc) return <p style={{ fontSize: 12, textAlign: 'center', marginTop: 32, color: 'rgba(100,116,139,0.5)' }}>No se pudo cargar la información.</p>;

  const tipoCfg = TIPO_BADGE[doc.tipo] ?? { bg: 'rgba(255,255,255,0.07)', color: '#94a3b8' };
  const estadoCfg = ESTADO_BADGE[doc.estado] ?? { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8' };

  let datosObj: Record<string, unknown> | null = null;
  try { datosObj = doc.datosClave ? JSON.parse(doc.datosClave) as Record<string, unknown> : null; } catch { /* ignora */ }

  const fs = compact ? 11 : 12;
  const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: compact ? '8px 10px' : '10px 14px' };
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600 as const, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'rgba(100,116,139,0.6)', marginBottom: 4, display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {doc.resumen && (
        <div style={{ borderLeft: '2px solid rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.04)', borderRadius: '0 8px 8px 0', padding: compact ? '7px 10px' : '9px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block', flexShrink: 0 }} />
            <span style={labelStyle}>Resumen IA</span>
          </div>
          <p style={{ fontSize: fs, color: 'rgba(203,213,225,0.85)', lineHeight: 1.65, fontStyle: 'italic', margin: 0 }}>{doc.resumen}</p>
        </div>
      )}
      {datosObj && Object.keys(datosObj).length > 0 && (
        <div style={cardStyle}>
          <span style={labelStyle}>Datos clave</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 2 }}>
            {Object.entries(datosObj).map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '4px 7px', gridColumn: String(v).length > 20 ? 'span 2' : undefined }}>
                <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
                <div style={{ fontSize: fs, color: '#cbd5e1', marginTop: 1, fontWeight: 500 }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {([
          { k: 'Tipo',        v: <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: tipoCfg.bg, color: tipoCfg.color }}>{doc.tipo}</span> },
          doc.area ? { k: 'Área',   v: <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: 'rgba(129,140,248,0.1)', color: '#a78bfa' }}>{doc.area}</span> } : null,
          { k: 'Estado',      v: <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: estadoCfg.bg, color: estadoCfg.color }}>{doc.estado}</span> },
          doc.tamanoBytes ? { k: 'Tamaño', v: fmtB(doc.tamanoBytes) } : null,
          doc.creadoPor ? { k: 'Creado por', v: doc.creadoPor } : null,
          { k: 'Creado',      v: fmtD(doc.createdAt) },
          { k: 'Actualizado', v: fmtD(doc.updatedAt) },
        ] as ({ k: string; v: React.ReactNode } | null)[]).filter(Boolean).map((row, i, arr) => (
          <div key={row!.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <span style={{ fontSize: fs - 1, color: 'rgba(100,116,139,0.55)' }}>{row!.k}</span>
            {typeof row!.v === 'string'
              ? <span style={{ fontSize: fs - 1, color: '#94a3b8', textAlign: 'right' }}>{row!.v}</span>
              : row!.v}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExploradorPage() {
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<{ label: string; path: string }[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [focusedEntry, setFocusedEntry] = useState<Entry | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [preview, setPreview] = useState<{ type: string; content?: string; base64?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, { estado: string; id: string }>>({});
  const [visorDoc, setVisorDoc] = useState<{ id: string; nombre: string; tipo: string } | null>(null);
  const [docFull, setDocFull] = useState<DocFull | null>(null);
  const [docFullLoading, setDocFullLoading] = useState(false);
  // Gold — asignación a cliente
  const [goldInfo, setGoldInfo] = useState<GoldInfo | null | 'none'>('none');
  const [goldClientes, setGoldClientes] = useState<ClienteOpt[]>([]);
  const [goldSugerencias, setGoldSugerencias] = useState<GoldSugerencia[]>([]);
  const [goldClienteId, setGoldClienteId] = useState('');
  const [goldNotas, setGoldNotas] = useState('');
  const [goldLoading, setGoldLoading] = useState(false);
  const [goldSaving, setGoldSaving] = useState(false);
  const [goldExpedientes, setGoldExpedientes] = useState<ExpedienteOpt[]>([]);
  const [goldExpedienteId, setGoldExpedienteId] = useState('');
  const [goldNuevoExpForm, setGoldNuevoExpForm] = useState(false);
  const [goldNuevoExpNombre, setGoldNuevoExpNombre] = useState('');
  const [goldNuevoExpCodigo, setGoldNuevoExpCodigo] = useState('');
  const [goldCreandoExp, setGoldCreandoExp] = useState(false);
  const [goldNuevoForm, setGoldNuevoForm] = useState(false);
  const [goldNuevoNombre, setGoldNuevoNombre] = useState('');
  const [goldNuevoNit, setGoldNuevoNit] = useState('');
  const [goldNuevoTipo, setGoldNuevoTipo] = useState('EMPRESA');
  const [goldCreando, setGoldCreando] = useState(false);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  // Drag & drop
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dragCounter = useRef(0);
  // Modals
  const [renameModal, setRenameModal] = useState<{ entry: Entry; value: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<Entry[] | null>(null);
  const [moveModal, setMoveModal] = useState<Entry[] | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveFolders, setMoveFolders] = useState<Entry[]>([]);
  // Feedback
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [importing, setImporting] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Poll status while any file is PROCESANDO
  useEffect(() => {
    const hasPending = Object.values(statusMap).some(s => s?.estado === 'PROCESANDO');
    if (!hasPending || !currentPath) return;
    const id = setTimeout(async () => {
      const res = await fetch(`/api/fs/status?dir=${encodeURIComponent(currentPath)}`);
      setStatusMap(await res.json());
    }, 3000);
    return () => clearTimeout(id);
  }, [statusMap, currentPath]);

  const navigate = useCallback(async (p: string) => {
    setLoading(true);
    setFocusedEntry(null);
    setPreview(null);
    setSelectedPaths(new Set());
    setSearch('');
    setVersions([]);
    try {
      const res = await fetch(`/api/fs${p ? '?path=' + encodeURIComponent(p) : ''}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setCurrentPath(p);
      if (!p) {
        setBreadcrumb([]);
      } else {
        const rootMatch = Object.entries(ROOT_LABELS).find(([k]) => p === k || p.startsWith(k + '/'));
        if (rootMatch) {
          const [rootPath, rootLabel] = rootMatch;
          if (p === rootPath) {
            setBreadcrumb([{ label: rootLabel, path: rootPath }]);
          } else {
            const rel = p.slice(rootPath.length + 1);
            const crumbs = [{ label: rootLabel, path: rootPath }];
            let acc = rootPath;
            for (const part of rel.split('/')) { acc += '/' + part; crumbs.push({ label: part, path: acc }); }
            setBreadcrumb(crumbs);
          }
        } else {
          setBreadcrumb([{ label: p, path: p }]);
        }
      }
      if (p) {
        fetch(`/api/fs/status?dir=${encodeURIComponent(p)}`).then(r => r.json()).then(s => setStatusMap(s)).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { navigate(''); }, [navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openFile = async (entry: Entry, smMap?: Record<string, { estado: string; id: string }>) => {
    setFocusedEntry(entry);
    setPreview(null);
    setVersions([]);
    setDocFull(null);
    setGoldInfo('none');
    setGoldSugerencias([]);
    setGoldClienteId('');
    setGoldExpedientes([]);
    setGoldExpedienteId('');
    setGoldNotas('');
    setDetailTab('info');
    // Auto-carga datos GOLD cuando el archivo vive en la capa gold
    if (currentPath.includes('/app/gold') || currentPath.includes('gold/clientes')) {
      const map = smMap ?? statusMap;
      const docId = map[entry.name]?.id;
      if (docId) {
        loadGold(docId);
        loadDocFull(docId);
      }
    }
    const ext = entry.ext ?? '';
    if (PREVIEWABLE_TEXT.has(ext) || ext === '.pdf') {
      setPreviewLoading(true);
      fetch(`/api/fs/preview?path=${encodeURIComponent(entry.fullPath)}`)
        .then(r => r.json()).then(setPreview).finally(() => setPreviewLoading(false));
    }
  };

  const loadDocFull = async (id: string) => {
    setDocFullLoading(true);
    try {
      const res = await fetch(`/api/documentos/${id}`);
      setDocFull(await res.json());
    } catch { /* silencioso */ }
    finally { setDocFullLoading(false); }
  };

  const loadGold = async (docId: string) => {
    setGoldLoading(true);
    try {
      const [goldRes, clientesRes, sugRes] = await Promise.all([
        fetch(`/api/gold?documentoId=${docId}`),
        fetch('/api/clientes'),
        fetch(`/api/gold/sugerir?documentoId=${docId}`),
      ]);
      const goldData = await goldRes.json() as GoldInfo[];
      setGoldInfo(goldData.length > 0 ? goldData[0] : null);
      setGoldClienteId(goldData.length > 0 ? goldData[0].clienteId : '');
      setGoldExpedienteId(goldData.length > 0 ? (goldData[0].expedienteId ?? '') : '');
      if (goldData.length > 0 && goldData[0].clienteId) {
        const expRes = await fetch(`/api/expedientes?clienteId=${goldData[0].clienteId}`);
        setGoldExpedientes(await expRes.json() as ExpedienteOpt[]);
      }
      setGoldClientes(await clientesRes.json() as ClienteOpt[]);
      const sugData = await sugRes.json() as { sugerencias: GoldSugerencia[] };
      setGoldSugerencias(sugData.sugerencias ?? []);
    } finally { setGoldLoading(false); }
  };

  const saveGold = async (docId: string) => {
    if (!goldClienteId) return;
    setGoldSaving(true);
    const res = await fetch('/api/gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoId: docId, clienteId: goldClienteId, expedienteId: goldExpedienteId || undefined, notas: goldNotas }),
    });
    if (res.ok) {
      const g = await res.json() as GoldInfo;
      setGoldInfo(g);
      showToast('Asignado a cliente ✓');
    } else { showToast('Error al asignar', false); }
    setGoldSaving(false);
  };

  const cargarExpedientes = async (clienteId: string) => {
    if (!clienteId) { setGoldExpedientes([]); setGoldExpedienteId(''); return; }
    const res = await fetch(`/api/expedientes?clienteId=${clienteId}`);
    setGoldExpedientes(await res.json() as ExpedienteOpt[]);
    setGoldExpedienteId('');
  };

  const crearExpedienteGold = async () => {
    if (!goldClienteId || !goldNuevoExpNombre.trim()) return;
    setGoldCreandoExp(true);
    const res = await fetch('/api/expedientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: goldClienteId, nombre: goldNuevoExpNombre.trim(), codigo: goldNuevoExpCodigo.trim() || undefined }),
    });
    if (res.ok) {
      const nuevo = await res.json() as ExpedienteOpt;
      setGoldExpedientes(prev => [nuevo, ...prev]);
      setGoldExpedienteId(nuevo.id);
      setGoldNuevoExpForm(false);
      setGoldNuevoExpNombre('');
      setGoldNuevoExpCodigo('');
    } else { showToast('Error al crear expediente', false); }
    setGoldCreandoExp(false);
  };

  const crearClienteGold = async (docId: string) => {
    if (!goldNuevoNombre.trim()) return;
    setGoldCreando(true);
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: goldNuevoNombre.trim(), nit: goldNuevoNit.trim() || undefined, tipo: goldNuevoTipo }),
    });
    if (res.ok) {
      const nuevo = await res.json() as ClienteOpt;
      setGoldClientes(prev => [...prev, nuevo]);
      setGoldClienteId(nuevo.id);
      setGoldNuevoForm(false);
      setGoldNuevoNombre('');
      setGoldNuevoNit('');
      setGoldNuevoTipo('EMPRESA');
    } else {
      showToast('Error al crear cliente', false);
    }
    setGoldCreando(false);
  };

  const loadVersions = async (entry: Entry) => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/fs/versions?path=${encodeURIComponent(entry.fullPath)}`);
      setVersions(await res.json());
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleSelect = (path: string) => setSelectedPaths(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const filesOnly = entries.filter(e => e.type === 'file');
  const allSelected = filesOnly.length > 0 && selectedPaths.size === filesOnly.length;
  const toggleSelectAll = () => setSelectedPaths(allSelected ? new Set() : new Set(filesOnly.map(e => e.fullPath)));

  // ── Operations ──────────────────────────────────────────────────────────

  const doRename = async () => {
    if (!renameModal) return;
    const { entry, value } = renameModal;
    const res = await fetch('/api/fs/rename', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: entry.fullPath, newName: value }) });
    setRenameModal(null);
    if (res.ok) { showToast(`✓ Renombrado a "${value}"`); await navigate(currentPath); }
    else { const d = await res.json(); showToast('Error: ' + d.error, false); }
  };

  const doDelete = async () => {
    if (!deleteModal) return;
    const targets = deleteModal;
    setDeleteModal(null);
    let errors = 0;
    for (const e of targets) {
      const res = await fetch(`/api/fs/delete?path=${encodeURIComponent(e.fullPath)}`, { method: 'DELETE' });
      if (!res.ok) errors++;
    }
    if (errors === 0) showToast(`✓ ${targets.length} elemento(s) eliminado(s)`);
    else showToast(`${errors} error(es) al eliminar`, false);
    setSelectedPaths(new Set());
    setFocusedEntry(null);
    await navigate(currentPath);
  };

  const doMove = async () => {
    if (!moveModal || !moveTarget) return;
    const targets = moveModal;
    setMoveModal(null);
    let errors = 0;
    for (const e of targets) {
      const res = await fetch('/api/fs/move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: e.fullPath, toDir: moveTarget }) });
      if (!res.ok) errors++;
    }
    if (errors === 0) showToast(`✓ ${targets.length} elemento(s) movido(s)`);
    else showToast(`${errors} error(es) al mover`, false);
    setSelectedPaths(new Set());
    setFocusedEntry(null);
    setMoveTarget('');
    await navigate(currentPath);
  };

  const importar = async (entry: Entry) => {
    setImporting(true);
    try {
      const fileRes = await fetch(`/api/fs/download?path=${encodeURIComponent(entry.fullPath)}`);
      const blob = await fileRes.blob();
      const form = new FormData();
      form.append('archivo', blob, entry.name);
      form.append('origenCarpeta', entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/')));
      const res = await fetch('/api/documentos', { method: 'POST', body: form });
      if (res.ok) {
        showToast('✓ Procesado y registrado en el gestor');
        setStatusMap(prev => ({ ...prev, [entry.name]: { estado: 'PROCESANDO', id: '' } }));
      } else {
        const err = await res.json();
        showToast('Error: ' + (err.error ?? 'desconocido'), false);
      }
    } catch { showToast('Error al procesar', false); }
    finally { setImporting(false); }
  };

  // Drag & drop
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.types.includes('Files')) setDragging(true); };
  const onDragLeave = () => { dragCounter.current--; if (dragCounter.current === 0) setDragging(false); };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    if (!currentPath) return;
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach(f => form.append('file', f));
      const res = await fetch(`/api/fs/upload?dir=${encodeURIComponent(currentPath)}`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) { showToast(`✓ ${data.uploaded.length} archivo(s) subido(s)`); await navigate(currentPath); }
      else showToast('Error: ' + (data.error ?? 'desconocido'), false);
    } catch { showToast('Error al subir', false); }
    finally { setUploading(false); }
  };

  // Load folders for move modal
  const openMoveModal = async (targets: Entry[]) => {
    setMoveModal(targets);
    setMoveTarget('');
    // Load all root dirs
    const res = await fetch('/api/fs');
    const data = await res.json();
    setMoveFolders(data.entries?.filter((e: Entry) => e.type === 'dir') ?? []);
  };

  // Filter + sort
  const filtered = entries
    .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'size') cmp = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
      else if (sortField === 'modified') cmp = (a.modifiedAt ?? '').localeCompare(b.modifiedAt ?? '');
      else if (sortField === 'type') cmp = (a.ext ?? '').localeCompare(b.ext ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const SortIcon = ({ field }: { field: SortField }) => (
    <span style={{ color: sortField === field ? BRAND_L : 'rgba(100,116,139,0.4)', fontSize: 9, marginLeft: 2 }}>
      {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  const selectedEntries = [...selectedPaths].map(p => entries.find(e => e.fullPath === p)).filter(Boolean) as Entry[];

  return (
    <GestorLayout>
      <div className="flex flex-col h-full gap-3" style={{ fontFamily: FONT }}
        onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>

        {/* ── Drag overlay ── */}
        {dragging && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(4,4,14,0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="flex flex-col items-center gap-3 p-10 rounded-3xl" style={{ border: `2px dashed ${BRAND}`, background: 'rgba(245,158,11,0.08)' }}>
              <span style={{ fontSize: 48 }}>📂</span>
              <p style={{ color: BRAND_L, fontSize: 16, fontWeight: 600 }}>Soltar para subir a esta carpeta</p>
            </div>
          </div>
        )}

        {/* ── Toast ── */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl" style={{ background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${toast.ok ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, color: toast.ok ? '#34d399' : '#f87171', backdropFilter: 'blur(12px)' }}>
            {toast.msg}
          </div>
        )}

        {/* ── Context menu ── */}
        {ctxMenu && (
          <div ref={ctxRef} className="fixed z-50 rounded-xl overflow-hidden py-1" style={{ top: ctxMenu.y, left: ctxMenu.x, ...GLASS, minWidth: 190, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {[
              { label: '↓ Descargar',          fn: () => { window.location.href = `/api/fs/download?path=${encodeURIComponent(ctxMenu.entry.fullPath)}`; setCtxMenu(null); } },
              { label: '⤴ Procesar en gestor', fn: () => { importar(ctxMenu.entry); setCtxMenu(null); }, hide: !IMPORTABLE.has(ctxMenu.entry.ext ?? '') },
              { label: '✎ Renombrar',          fn: () => { setRenameModal({ entry: ctxMenu.entry, value: ctxMenu.entry.name }); setCtxMenu(null); } },
              { label: '→ Mover',              fn: () => { openMoveModal([ctxMenu.entry]); setCtxMenu(null); } },
              { label: '⎘ Copiar ruta',        fn: () => { navigator.clipboard.writeText(ctxMenu.entry.fullPath).catch(() => {}); setCtxMenu(null); showToast('✓ Ruta copiada'); } },
              { label: '🗑 Eliminar',           fn: () => { setDeleteModal([ctxMenu.entry]); setCtxMenu(null); }, danger: true },
            ].filter(i => !i.hide).map((item, i) => (
              <button key={i} onClick={item.fn} className="w-full text-left px-4 py-2 transition-all" style={{ fontSize: 13, color: item.danger ? '#f87171' : '#cbd5e1' }}
                onMouseEnter={e => (e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.07)') }
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Rename Modal ── */}
        {renameModal && (
          <Modal title="Renombrar" onClose={() => setRenameModal(null)}>
            <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.7)' }}>Nuevo nombre para <span style={{ color: BRAND_L }}>{renameModal.entry.name}</span></p>
            <input
              autoFocus
              value={renameModal.value}
              onChange={e => setRenameModal(m => m ? { ...m, value: e.target.value } : m)}
              onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenameModal(null); }}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-4"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0' }}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenameModal(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.8)' }}>Cancelar</button>
              <button onClick={doRename} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: BRAND_L }}>Renombrar</button>
            </div>
          </Modal>
        )}

        {/* ── Delete Modal ── */}
        {deleteModal && (
          <Modal title="Confirmar eliminación" onClose={() => setDeleteModal(null)}>
            <p className="text-sm mb-2" style={{ color: '#e2e8f0' }}>¿Eliminar {deleteModal.length === 1 ? `"${deleteModal[0].name}"` : `${deleteModal.length} elementos`}?</p>
            <p className="text-xs mb-5" style={{ color: 'rgba(248,113,113,0.8)' }}>Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteModal(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.8)' }}>Cancelar</button>
              <button onClick={doDelete} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}>Eliminar</button>
            </div>
          </Modal>
        )}

        {/* ── Move Modal ── */}
        {moveModal && (
          <Modal title={`Mover ${moveModal.length === 1 ? `"${moveModal[0].name}"` : `${moveModal.length} elementos`}`} onClose={() => setMoveModal(null)}>
            <p className="text-xs mb-3" style={{ color: 'rgba(148,163,184,0.6)' }}>Seleccioná el directorio destino</p>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid rgba(255,255,255,0.08)', maxHeight: 200, overflowY: 'auto' }}>
              {Object.entries(ROOT_LABELS).map(([path, label]) => (
                <button key={path} onClick={() => setMoveTarget(path)} className="w-full text-left px-4 py-2.5 flex items-center gap-2 transition-all"
                  style={{ background: moveTarget === path ? 'rgba(245,158,11,0.1)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)', color: moveTarget === path ? BRAND_L : '#cbd5e1', fontSize: 13 }}
                  onMouseEnter={e => { if (moveTarget !== path) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (moveTarget !== path) e.currentTarget.style.background = 'transparent'; }}>
                  <span>📁</span> {label}
                  {moveTarget === path && <span className="ml-auto" style={{ color: BRAND }}>✓</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMoveModal(null)} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.8)' }}>Cancelar</button>
              <button onClick={doMove} disabled={!moveTarget} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: BRAND_L, opacity: moveTarget ? 1 : 0.5 }}>Mover aquí</button>
            </div>
          </Modal>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}>
              <svg className="w-5 h-5" style={{ color: '#34d399' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>Explorador de Archivos</h1>
              <p className="text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>Sistema de archivos del servidor</p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['list', 'grid', 'compact'] as ViewMode[]).map(mode => {
              const icons: Record<ViewMode, string> = { list: '☰', grid: '⊞', compact: '≡' };
              return (
                <button key={mode} onClick={() => setViewMode(mode)} title={mode}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                  style={{ fontSize: 14, background: viewMode === mode ? 'rgba(245,158,11,0.15)' : 'transparent', color: viewMode === mode ? BRAND_L : 'rgba(100,116,139,0.7)' }}>
                  {icons[mode]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Breadcrumb + Search ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 flex-1 flex-wrap" style={{ fontSize: 12 }}>
            <button onClick={() => navigate('')} style={{ color: breadcrumb.length === 0 ? BRAND_L : 'rgba(148,163,184,0.8)', fontWeight: 500 }}>Raíz</button>
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <span style={{ color: 'rgba(100,116,139,0.5)' }}>/</span>
                <button onClick={() => navigate(crumb.path)} style={{ color: i === breadcrumb.length - 1 ? BRAND_L : 'rgba(148,163,184,0.8)', fontWeight: i === breadcrumb.length - 1 ? 600 : 400 }}>
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>
          <div className="relative flex-shrink-0" style={{ width: 220 }}>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(100,116,139,0.6)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar archivos..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', fontSize: 12 }} />
          </div>
        </div>

        {/* ── Bulk action bar ── */}
        {selectedPaths.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)' }}>
            <span style={{ color: BRAND_L, fontSize: 12, fontWeight: 600 }}>{selectedPaths.size} seleccionado(s)</span>
            <div className="flex gap-2 ml-auto flex-wrap">
              {[
                { label: '↓ Descargar', fn: () => selectedEntries.forEach(e => { window.location.href = `/api/fs/download?path=${encodeURIComponent(e.fullPath)}`; }), color: BRAND_L, bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
                { label: '⤴ Procesar', fn: () => selectedEntries.filter(e => IMPORTABLE.has(e.ext ?? '')).forEach(e => importar(e)), color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
                { label: '→ Mover', fn: () => openMoveModal(selectedEntries), color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)' },
                { label: '🗑 Eliminar', fn: () => setDeleteModal(selectedEntries), color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
              ].map((btn, i) => (
                <button key={i} onClick={btn.fn} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: btn.bg, border: `1px solid ${btn.border}`, color: btn.color }}>
                  {btn.label}
                </button>
              ))}
              <button onClick={() => setSelectedPaths(new Set())} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.7)' }}>Limpiar</button>
            </div>
          </div>
        )}

        {/* ── Main panel ── */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* File panel */}
          <div className="flex flex-col flex-1 min-w-0 rounded-2xl overflow-hidden" style={GLASS}>

            {/* ── LIST ── */}
            {viewMode === 'list' && (
              <>
                <div className="grid px-4 py-2" style={{ gridTemplateColumns: '20px 1fr 80px 140px 90px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(100,116,139,0.7)' }}>
                  <label className="flex items-center"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-3 h-3 accent-amber-400" /></label>
                  <button className="text-left flex items-center gap-1" onClick={() => handleSort('name')}>Nombre <SortIcon field="name" /></button>
                  <button className="text-right flex items-center justify-end gap-1" onClick={() => handleSort('size')}>Tamaño <SortIcon field="size" /></button>
                  <button className="text-right flex items-center justify-end gap-1" onClick={() => handleSort('modified')}>Modificado <SortIcon field="modified" /></button>
                  <button className="text-right flex items-center justify-end gap-1" onClick={() => handleSort('type')}>Tipo <SortIcon field="type" /></button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading ? <div className="flex items-center justify-center h-32" style={{ color: 'rgba(100,116,139,0.6)', fontSize: 13 }}>Cargando...</div>
                    : filtered.length === 0 ? <div className="flex items-center justify-center h-32" style={{ color: 'rgba(100,116,139,0.6)', fontSize: 13 }}>{search ? `Sin resultados para "${search}"` : 'Carpeta vacía — arrastrá archivos aquí'}</div>
                    : filtered.map(entry => {
                      const isActive = focusedEntry?.fullPath === entry.fullPath;
                      const isChecked = selectedPaths.has(entry.fullPath);
                      const status = statusMap[entry.name]?.estado;
                      return (
                        <div key={entry.fullPath} className="grid px-4 py-2.5 items-center" style={{ gridTemplateColumns: '20px 1fr 80px 140px 90px', gap: 8, background: isActive ? 'rgba(245,158,11,0.08)' : isChecked ? 'rgba(245,158,11,0.04)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)', borderLeft: isActive ? `2px solid ${BRAND}` : '2px solid transparent', cursor: 'pointer' }}
                          onClick={() => entry.type === 'dir' ? navigate(entry.fullPath) : openFile(entry)}
                          onContextMenu={e => { if (entry.type === 'file') { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, entry }); } }}>
                          <label onClick={e => e.stopPropagation()} className="flex items-center">
                            {entry.type === 'file' && <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(entry.fullPath)} className="w-3 h-3 accent-amber-400" />}
                          </label>
                          <span className="flex items-center gap-2 min-w-0">
                            <span style={{ fontSize: 14, flexShrink: 0 }}>{entry.type === 'dir' ? '📁' : fileEmoji(entry.ext)}</span>
                            <span className="truncate" style={{ fontSize: 13, color: isActive ? BRAND_L : entry.type === 'dir' ? '#e2e8f0' : '#cbd5e1', fontWeight: entry.type === 'dir' ? 500 : 400 }}>{ROOT_LABELS[`/app/${entry.name}`] ?? entry.name}</span>
                            {entry.type === 'file' && <StatusChip status={status} />}
                          </span>
                          <span className="text-right" style={{ fontSize: 11, color: 'rgba(100,116,139,0.7)' }}>{entry.type === 'file' ? formatBytes(entry.sizeBytes) : '—'}</span>
                          <span className="text-right" style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)' }}>{formatDate(entry.modifiedAt)}</span>
                          <span className="text-right" style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)', letterSpacing: '0.04em' }}>{entry.ext?.toUpperCase().slice(1) ?? 'DIR'}</span>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {/* ── GRID ── */}
            {viewMode === 'grid' && (
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? <div className="flex items-center justify-center h-32" style={{ color: 'rgba(100,116,139,0.6)', fontSize: 13 }}>Cargando...</div>
                  : <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                    {filtered.map(entry => {
                      const isActive = focusedEntry?.fullPath === entry.fullPath;
                      const isChecked = selectedPaths.has(entry.fullPath);
                      return (
                        <div key={entry.fullPath} className="flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition-all relative"
                          style={{ background: isActive ? 'rgba(245,158,11,0.12)' : isChecked ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)'}` }}
                          onClick={() => entry.type === 'dir' ? navigate(entry.fullPath) : openFile(entry)}
                          onContextMenu={e => { if (entry.type === 'file') { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, entry }); } }}>
                          {entry.type === 'file' && <label onClick={e => e.stopPropagation()} className="absolute top-2 left-2"><input type="checkbox" checked={isChecked} onChange={() => toggleSelect(entry.fullPath)} className="w-3 h-3 accent-amber-400" /></label>}
                          <span style={{ fontSize: 34 }}>{entry.type === 'dir' ? '📁' : fileEmoji(entry.ext)}</span>
                          <span className="text-center w-full truncate" style={{ fontSize: 11, color: isActive ? BRAND_L : '#cbd5e1' }}>{ROOT_LABELS[`/app/${entry.name}`] ?? entry.name}</span>
                          {entry.type === 'file' && <StatusChip status={statusMap[entry.name]?.estado} />}
                          <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)' }}>{entry.type === 'file' ? formatBytes(entry.sizeBytes) : ''}</span>
                        </div>
                      );
                    })}
                  </div>}
              </div>
            )}

            {/* ── COMPACT ── */}
            {viewMode === 'compact' && (
              <div className="flex-1 overflow-y-auto">
                {loading ? <div className="flex items-center justify-center h-32" style={{ color: 'rgba(100,116,139,0.6)', fontSize: 13 }}>Cargando...</div>
                  : filtered.map(entry => {
                    const isActive = focusedEntry?.fullPath === entry.fullPath;
                    const isChecked = selectedPaths.has(entry.fullPath);
                    return (
                      <div key={entry.fullPath} className="flex items-center gap-2 px-3 py-1.5"
                        style={{ background: isActive ? 'rgba(245,158,11,0.08)' : isChecked ? 'rgba(245,158,11,0.04)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)', borderLeft: isActive ? `2px solid ${BRAND}` : '2px solid transparent', cursor: 'pointer' }}
                        onClick={() => entry.type === 'dir' ? navigate(entry.fullPath) : openFile(entry)}
                        onContextMenu={e => { if (entry.type === 'file') { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, entry }); } }}>
                        {entry.type === 'file' && <label onClick={e => e.stopPropagation()}><input type="checkbox" checked={isChecked} onChange={() => toggleSelect(entry.fullPath)} className="w-3 h-3 accent-amber-400" /></label>}
                        <span style={{ fontSize: 13 }}>{entry.type === 'dir' ? '📁' : fileEmoji(entry.ext)}</span>
                        <span className="flex-1 truncate" style={{ fontSize: 12, color: isActive ? BRAND_L : '#cbd5e1' }}>{ROOT_LABELS[`/app/${entry.name}`] ?? entry.name}</span>
                        {entry.type === 'file' && <StatusChip status={statusMap[entry.name]?.estado} />}
                        <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)', flexShrink: 0 }}>{entry.type === 'file' ? formatBytes(entry.sizeBytes) : ''}</span>
                        <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.4)', flexShrink: 0 }}>{formatDate(entry.modifiedAt)}</span>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'rgba(100,116,139,0.6)' }}>
              <span>{filtered.length} elemento(s){search && ` · "${search}"`}</span>
              {uploading ? <span style={{ color: BRAND_L }}>⏳ Subiendo...</span> : currentPath ? <span>Arrastrá archivos aquí para subirlos</span> : null}
            </div>
          </div>

          {/* ── Detail drawer ── */}
          {focusedEntry && focusedEntry.type === 'file' && (
            <div className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0" style={{ ...GLASS, width: 300 }}>
              {/* File summary */}
              <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <span style={{ fontSize: 26 }}>{fileEmoji(focusedEntry.ext)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{focusedEntry.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.6)' }}>{formatBytes(focusedEntry.sizeBytes)}</p>
                    <p className="text-xs" style={{ color: 'rgba(148,163,184,0.5)' }}>{formatDate(focusedEntry.modifiedAt)}</p>
                    <div className="mt-1.5"><StatusChip status={statusMap[focusedEntry.name]?.estado} /></div>
                  </div>
                </div>
                {/* Quick actions */}
                <div className="flex gap-2">
                  <button onClick={() => window.location.href = `/api/fs/download?path=${encodeURIComponent(focusedEntry.fullPath)}`}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: BRAND_L }}>↓ Descargar</button>
                  <button onClick={() => setRenameModal({ entry: focusedEntry, value: focusedEntry.name })}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(203,213,225,0.8)' }}>✎</button>
                  <button onClick={() => setDeleteModal([focusedEntry])}
                    className="py-1.5 px-3 rounded-lg text-xs font-medium" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>🗑</button>
                </div>
                {/* Abrir en visor — solo si el doc está indexado en la DB */}
                {statusMap[focusedEntry.name]?.id && (
                  <button
                    onClick={() => setVisorDoc({ id: statusMap[focusedEntry.name].id, nombre: focusedEntry.name, tipo: '' })}
                    className="w-full py-1.5 rounded-lg text-xs font-medium mt-2"
                    style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', color: '#38bdf8' }}>
                    👁 Abrir documento
                  </button>
                )}
                {/* 🥇 Asignación gold — solo en Procesados con doc indexado */}
                {currentPath.includes('procesados') && statusMap[focusedEntry.name]?.id && (
                  <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>🥇 Cliente</span>
                      {goldInfo === 'none' && (
                        <button onClick={() => loadGold(statusMap[focusedEntry.name].id)}
                          style={{ fontSize: 10, color: 'rgba(245,158,11,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Cargar ↓
                        </button>
                      )}
                    </div>
                    {goldLoading && <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)' }}>Cargando...</p>}
                    {!goldLoading && goldInfo !== 'none' && (
                      <>
                        {goldInfo && (
                          <p className="mb-2" style={{ fontSize: 11, color: '#34d399' }}>✓ {goldInfo.cliente.nombre}</p>
                        )}
                        {!goldInfo && goldSugerencias.length > 0 && (
                          <div className="mb-2">
                            <p style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)', marginBottom: 4 }}>SUGERENCIAS IA</p>
                            {goldSugerencias.slice(0, 3).map(s => (
                              <button key={s.clienteId} onClick={() => setGoldClienteId(s.clienteId)}
                                className="w-full text-left px-2 py-1 rounded mb-1 flex justify-between"
                                style={{ background: goldClienteId === s.clienteId ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${goldClienteId === s.clienteId ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                                <span style={{ fontSize: 11, color: '#e2e8f0' }}>{s.nombre}</span>
                                <span style={{ fontSize: 10, color: '#34d399' }}>{Math.round(s.similitud * 100)}%</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1.5 mb-2">
                          <select value={goldClienteId} onChange={e => { setGoldClienteId(e.target.value); cargarExpedientes(e.target.value); }}
                            className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                            style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: goldClienteId ? '#f1f5f9' : '#475569' }}>
                            <option value="">Seleccionar cliente...</option>
                            {goldClientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                          <button onClick={() => { setGoldNuevoForm(v => !v); setGoldNuevoNombre(''); setGoldNuevoNit(''); }}
                            className="px-2 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                            style={{ background: goldNuevoForm ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${goldNuevoForm ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.1)'}`, color: goldNuevoForm ? '#fbbf24' : '#94a3b8' }}>
                            {goldNuevoForm ? '✕' : '+ Nuevo'}
                          </button>
                        </div>
                        {goldNuevoForm && (
                          <div className="rounded-lg p-2.5 mb-2 flex flex-col gap-1.5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                            <input
                              autoFocus
                              value={goldNuevoNombre}
                              onChange={e => setGoldNuevoNombre(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && focusedEntry) crearClienteGold(statusMap[focusedEntry.name]?.id ?? ''); if (e.key === 'Escape') setGoldNuevoForm(false); }}
                              placeholder="Nombre del cliente *"
                              className="w-full rounded px-2 py-1.5 text-xs"
                              style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }} />
                            <div className="flex gap-1.5" style={{ minWidth: 0 }}>
                              <input
                                value={goldNuevoNit}
                                onChange={e => setGoldNuevoNit(e.target.value)}
                                placeholder="NIT / CC"
                                className="rounded px-2 py-1.5 text-xs min-w-0"
                                style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', flex: '1 1 0' }} />
                              <select value={goldNuevoTipo} onChange={e => setGoldNuevoTipo(e.target.value)}
                                className="rounded px-1.5 py-1.5 text-xs flex-shrink-0"
                                style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', width: 90 }}>
                                <option value="EMPRESA">Empresa</option>
                                <option value="PERSONA_NATURAL">Persona</option>
                              </select>
                            </div>
                            <button
                              onClick={() => focusedEntry && crearClienteGold(statusMap[focusedEntry.name]?.id ?? '')}
                              disabled={!goldNuevoNombre.trim() || goldCreando}
                              className="w-full py-1.5 rounded text-xs font-semibold"
                              style={{ background: goldNuevoNombre.trim() ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${goldNuevoNombre.trim() ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}`, color: goldNuevoNombre.trim() ? '#34d399' : '#475569', cursor: goldNuevoNombre.trim() ? 'pointer' : 'not-allowed' }}>
                              {goldCreando ? 'Creando...' : '✓ Crear y seleccionar'}
                            </button>
                          </div>
                        )}
                        {/* Selector expediente */}
                        {goldClienteId && (
                          <div className="mb-2">
                            <p style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)', marginBottom: 4 }}>EXPEDIENTE (opcional)</p>
                            <div className="flex gap-1.5">
                              <select value={goldExpedienteId} onChange={e => setGoldExpedienteId(e.target.value)}
                                className="flex-1 rounded px-2 py-1.5 text-xs"
                                style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: goldExpedienteId ? '#f1f5f9' : '#475569' }}>
                                <option value="">Sin expediente</option>
                                {goldExpedientes.map(e => <option key={e.id} value={e.id}>{e.codigo ? `[${e.codigo}] ` : ''}{e.nombre}</option>)}
                              </select>
                              <button onClick={() => { setGoldNuevoExpForm(v => !v); setGoldNuevoExpNombre(''); setGoldNuevoExpCodigo(''); }}
                                className="px-2 py-1.5 rounded text-xs font-semibold flex-shrink-0"
                                style={{ background: goldNuevoExpForm ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${goldNuevoExpForm ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`, color: goldNuevoExpForm ? '#818cf8' : '#94a3b8' }}>
                                {goldNuevoExpForm ? '✕' : '+ Exp'}
                              </button>
                            </div>
                            {goldNuevoExpForm && (
                              <div className="rounded-lg p-2 mt-1.5 flex flex-col gap-1.5" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                <div className="flex gap-1.5">
                                  <input value={goldNuevoExpCodigo} onChange={e => setGoldNuevoExpCodigo(e.target.value)}
                                    placeholder="Código (ej. EXP-001)" className="rounded px-2 py-1.5 text-xs"
                                    style={{ width: 110, background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', flexShrink: 0 }} />
                                  <input autoFocus value={goldNuevoExpNombre} onChange={e => setGoldNuevoExpNombre(e.target.value)}
                                    placeholder="Nombre del expediente *" className="flex-1 rounded px-2 py-1.5 text-xs min-w-0"
                                    style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }} />
                                </div>
                                <button onClick={crearExpedienteGold} disabled={!goldNuevoExpNombre.trim() || goldCreandoExp}
                                  className="w-full py-1.5 rounded text-xs font-semibold"
                                  style={{ background: goldNuevoExpNombre.trim() ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${goldNuevoExpNombre.trim() ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`, color: goldNuevoExpNombre.trim() ? '#818cf8' : '#475569', cursor: goldNuevoExpNombre.trim() ? 'pointer' : 'not-allowed' }}>
                                  {goldCreandoExp ? 'Creando...' : '✓ Crear expediente'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <button onClick={() => saveGold(statusMap[focusedEntry.name].id)}
                          disabled={!goldClienteId || goldSaving}
                          className="w-full py-1.5 rounded-lg text-xs font-semibold"
                          style={{ background: goldClienteId ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${goldClienteId ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)'}`,
                            color: goldClienteId ? '#fbbf24' : '#475569',
                            cursor: goldClienteId && !goldSaving ? 'pointer' : 'not-allowed' }}>
                          {goldSaving ? 'Guardando...' : goldInfo ? '↺ Reasignar' : '🥇 Asignar a cliente'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Procesar en gestor — oculto si ya está en carpeta Procesados */}
                {IMPORTABLE.has(focusedEntry.ext ?? '') && currentPath.includes('ingesta') && (
                  <button onClick={() => importar(focusedEntry)} disabled={importing} className="w-full py-1.5 rounded-lg text-xs font-medium mt-2"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399', opacity: importing ? 0.6 : 1 }}>
                    {importing ? 'Procesando...' : '⤴ Procesar en gestor'}
                  </button>
                )}
              </div>

              {/* Tabs */}
              {(() => {
                const extraTabs: [DetailTab, string][] = currentPath.includes('procesados') && statusMap[focusedEntry.name]?.id
                  ? [['detalle', 'Detalle'], ['auditoria', 'Auditoría']]
                  : [];
                const allTabs: [DetailTab, string][] = [['info', 'Info'], ['preview', 'Preview'], ['versions', 'Versiones'], ...extraTabs];
                return (
                  <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {allTabs.map(([tab, label]) => (
                      <button key={tab} onClick={() => {
                        setDetailTab(tab);
                        if (tab === 'versions' && focusedEntry) loadVersions(focusedEntry);
                        if ((tab === 'detalle' || tab === 'auditoria') && statusMap[focusedEntry.name]?.id && !docFull && !docFullLoading) {
                          loadDocFull(statusMap[focusedEntry.name].id);
                        }
                      }}
                        className="flex-1 py-2 text-xs font-medium transition-all"
                        style={{ color: detailTab === tab ? BRAND_L : 'rgba(100,116,139,0.7)', borderBottom: detailTab === tab ? `2px solid ${BRAND}` : '2px solid transparent' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Tab content */}
              <div className="flex-1 overflow-auto p-3">

                {/* Info tab */}
                {detailTab === 'info' && (() => {
                  const ext = focusedEntry.ext?.toUpperCase() ?? '';
                  const ftypeBg = ext === 'PDF' ? 'rgba(226,75,74,0.18)' : ext === 'DOCX' || ext === 'DOC' ? 'rgba(55,138,221,0.18)' : 'rgba(100,116,139,0.18)';
                  const ftypeColor = ext === 'PDF' ? '#f87171' : ext === 'DOCX' || ext === 'DOC' ? '#60a5fa' : '#94a3b8';
                  const estadoKey = statusMap[focusedEntry.name]?.estado;
                  const estadoCfg = estadoKey ? (STATUS_CFG[estadoKey] ?? null) : null;
                  const isGoldPath = currentPath.includes('/app/gold') || currentPath.includes('gold/clientes');
                  const goldData = (isGoldPath && goldInfo && goldInfo !== 'none') ? goldInfo : null;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                      {/* ── GOLD card — cliente / expediente / resumen IA ── */}
                      {isGoldPath && (
                        goldLoading
                          ? <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', fontSize: 11, color: 'rgba(245,158,11,0.5)' }}>Cargando datos GOLD…</div>
                          : goldData ? (
                            <div style={{ borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)', overflow: 'hidden' }}>
                              {/* Header */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid rgba(245,158,11,0.12)' }}>
                                <span style={{ fontSize: 13 }}>🥇</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asignado a GOLD</span>
                              </div>
                              {/* Cliente row */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: goldData.expediente ? '1px solid rgba(245,158,11,0.08)' : 'none' }}>
                                <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.6)' }}>Cliente</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#fde68a' }}>{goldData.cliente.nombre}</span>
                              </div>
                              {/* Expediente row */}
                              {goldData.expediente && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px' }}>
                                  <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.6)' }}>Expediente</span>
                                  <span style={{ fontSize: 11, color: '#fde68a' }}>
                                    {goldData.expediente.codigo ? <span style={{ color: 'rgba(253,230,138,0.55)', marginRight: 4 }}>[{goldData.expediente.codigo}]</span> : null}
                                    {goldData.expediente.nombre}
                                  </span>
                                </div>
                              )}
                              {/* Resumen IA */}
                              {docFull?.resumen && (
                                <div style={{ borderTop: '1px solid rgba(245,158,11,0.1)', padding: '8px 10px' }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(245,158,11,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Resumen IA</div>
                                  <p style={{ fontSize: 11, color: 'rgba(203,213,225,0.8)', lineHeight: 1.65, fontStyle: 'italic', margin: 0 }}>{docFull.resumen}</p>
                                </div>
                              )}
                              {/* Tipo / Area chips */}
                              {(docFull?.tipo || docFull?.area) && (
                                <div style={{ borderTop: '1px solid rgba(245,158,11,0.08)', padding: '6px 10px', display: 'flex', gap: 5, flexWrap: 'wrap' as const }}>
                                  {docFull.tipo && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)' }}>{docFull.tipo}</span>}
                                  {docFull.area && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.2)' }}>{docFull.area}</span>}
                                </div>
                              )}
                            </div>
                          ) : null
                      )}

                      {/* Tipo de archivo + nombre */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: ftypeBg, color: ftypeColor, letterSpacing: '0.02em' }}>{ext || '?'}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{focusedEntry.name}</p>
                          <p style={{ fontSize: 10, color: 'rgba(100,116,139,0.6)', marginTop: 2 }}>{formatBytes(focusedEntry.sizeBytes)} · {formatDate(focusedEntry.modifiedAt)}</p>
                        </div>
                      </div>

                      {/* Metadatos en tabla compacta */}
                      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.55)' }}>Estado</span>
                          {estadoCfg
                            ? <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color, border: `1px solid ${estadoCfg.color}22` }}>{estadoCfg.icon} {estadoCfg.label}</span>
                            : <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)' }}>No indexado</span>}
                        </div>
                        {[
                          ['Extensión', ext || '—'],
                          ['Tamaño', formatBytes(focusedEntry.sizeBytes)],
                          ['Modificado', formatDate(focusedEntry.modifiedAt)],
                        ].map(([k, v], i) => (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.55)' }}>{k}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Ruta con botón copiar */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Ruta</span>
                          <button onClick={() => navigator.clipboard.writeText(focusedEntry.fullPath)}
                            style={{ fontSize: 9, color: 'rgba(129,140,248,0.7)', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 4, padding: '1px 6px', cursor: 'pointer' }}>
                            Copiar
                          </button>
                        </div>
                        <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5, margin: 0 }}>{focusedEntry.fullPath}</p>
                      </div>

                      <button onClick={() => openMoveModal([focusedEntry])} style={{ width: '100%', padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 500, textAlign: 'center', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.18)', color: '#818cf8', cursor: 'pointer' }}>
                        → Mover a otra carpeta
                      </button>
                    </div>
                  );
                })()}

                {/* Preview tab */}
                {detailTab === 'preview' && (
                  <>
                    {previewLoading && <p className="text-xs text-center mt-8" style={{ color: 'rgba(100,116,139,0.6)' }}>Cargando...</p>}
                    {!previewLoading && preview?.type === 'text' && (
                      <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: 'rgba(203,213,225,0.85)', fontFamily: 'monospace', lineHeight: 1.6 }}>{preview.content}</pre>
                    )}
                    {!previewLoading && preview?.type === 'pdf' && (
                      <iframe src={`data:application/pdf;base64,${preview.base64}`} className="w-full rounded-lg" style={{ height: 400, border: 'none' }} title={focusedEntry.name} />
                    )}
                    {!previewLoading && !preview && docFull?.textoExtraido && (
                      <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: 'rgba(203,213,225,0.85)', fontFamily: 'monospace', lineHeight: 1.6 }}>{docFull.textoExtraido.slice(0, 8000)}{docFull.textoExtraido.length > 8000 ? '\n\n[…texto truncado]' : ''}</pre>
                    )}
                    {!previewLoading && !preview && !docFull?.textoExtraido && (
                      <p className="text-xs text-center mt-8" style={{ color: 'rgba(100,116,139,0.5)' }}>Vista previa no disponible para este tipo de archivo</p>
                    )}
                  </>
                )}

                {/* Detalle tab */}
                {detailTab === 'detalle' && (
                  <DetallePanelContent doc={docFull} loading={docFullLoading} compact />
                )}

                {/* Auditoría tab */}
                {detailTab === 'auditoria' && (
                  <AuditoriaTimeline eventos={docFull?.eventos ?? []} loading={docFullLoading} />
                )}

                {/* Versions tab */}
                {detailTab === 'versions' && (
                  <>
                    {versionsLoading && <p className="text-xs text-center mt-8" style={{ color: 'rgba(100,116,139,0.6)' }}>Cargando historial...</p>}
                    {!versionsLoading && versions.length === 0 && (
                      <div className="flex flex-col items-center gap-2 mt-8">
                        <span style={{ fontSize: 28 }}>📭</span>
                        <p className="text-xs text-center" style={{ color: 'rgba(100,116,139,0.5)' }}>Este archivo aún no ha sido procesado por el gestor.</p>
                      </div>
                    )}
                    {!versionsLoading && versions.map((v, i) => (
                      <div key={v.id} className="rounded-xl p-3 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', fontWeight: 600 }}>v{versions.length - i}</span>
                          <StatusChip status={v.estado} />
                        </div>
                        <p style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(v.creadoEn)}</p>
                        {v.tipo && <p style={{ fontSize: 10, color: 'rgba(100,116,139,0.6)', marginTop: 2 }}>{v.tipo}{v.area ? ` · ${v.area}` : ''}</p>}
                        {v.resumen && <p className="mt-1.5" style={{ fontSize: 11, color: 'rgba(203,213,225,0.7)', lineHeight: 1.5 }}>{v.resumen.slice(0, 120)}{v.resumen.length > 120 ? '…' : ''}</p>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal visor de documento */}
      {visorDoc && (
        <DocVisorModal id={visorDoc.id} nombre={visorDoc.nombre} onClose={() => setVisorDoc(null)} />
      )}
    </GestorLayout>
  );
}

// ── Modal visor reutilizable ───────────────────────────────────────────────────
interface DocFull {
  id: string; nombre: string; tipo: string; area?: string; estado: string
  resumen?: string; datosClave?: string; textoExtraido?: string; mimeType?: string
  tamanoBytes?: number; creadoPor?: string; createdAt: string; updatedAt: string
  tieneArchivo: boolean
  eventos: { id: string; accion: string; actor?: string; detalle?: string; createdAt: string }[]
}

function fmtD(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtB(b?: number) {
  if (!b) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1_048_576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1_048_576).toFixed(1) + ' MB'
}

type VTab = 'archivo' | 'detalle' | 'auditoria'

function DocVisorModal({ id, nombre, onClose }: { id: string; nombre: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<VTab>('archivo')
  const [doc, setDoc] = useState<DocFull | null>(null)
  const [cargando, setCargando] = useState(true)

  const isPdf = /\.pdf$/i.test(nombre)
  const isTxt = /\.(txt|md|csv|json|xml)$/i.test(nombre)
  const url = `/api/documentos/${id}/archivo?inline=1`

  useEffect(() => {
    setMounted(true)
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    fetch(`/api/documentos/${id}`)
      .then(r => r.json()).then((d: DocFull) => setDoc(d)).catch(console.error)
      .finally(() => setCargando(false))
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [id, onClose])

  if (!mounted) return null

  const datosObj = (() => { try { return doc?.datosClave ? JSON.parse(doc.datosClave) as Record<string, unknown> : null } catch { return null } })()

  const TABS: { key: VTab; label: string }[] = [
    { key: 'archivo', label: 'Archivo' },
    { key: 'detalle', label: 'Detalle' },
    { key: 'auditoria', label: 'Auditoría' },
  ]

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{ maxHeight: '90vh', background: 'rgba(8,8,20,0.96)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span style={{ fontSize: 16 }}>📄</span>
            <span className="text-sm font-semibold text-white/90 truncate">{nombre}</span>
            {doc?.tipo && (
              <span className="text-[11px] px-2 py-0.5 rounded-md border font-semibold flex-shrink-0 text-sky-300 bg-sky-500/10 border-sky-500/25">
                {doc.tipo}
              </span>
            )}
            {doc?.estado && (
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold flex-shrink-0
                ${doc.estado === 'LISTO' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' : 'text-amber-300 bg-amber-500/10 border-amber-500/25'}`}>
                {doc.estado}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
            {doc?.tieneArchivo && (
              <>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 transition-all">
                  ↗ Nueva pestaña
                </a>
                <a href={`/api/documentos/${id}/archivo`} download
                  className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.07] transition-all">
                  ↓ Descargar
                </a>
              </>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all ml-1" title="Cerrar (Esc)">
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px"
              style={{ borderBottomColor: tab === t.key ? '#38bdf8' : 'transparent', color: tab === t.key ? '#38bdf8' : 'rgba(100,116,139,0.7)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto min-h-0">
          {tab === 'archivo' && (
            cargando ? <div className="flex justify-center py-20"><span style={{ color: '#38bdf8' }}>Cargando…</span></div>
            : isPdf ? <iframe src={url} className="w-full" style={{ minHeight: '65vh', border: 'none', background: '#fff' }} title={nombre} />
            : isTxt ? <pre className="p-6 text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>{doc?.textoExtraido ?? '(sin contenido extraído)'}</pre>
            : <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span style={{ fontSize: 40 }}>📄</span>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Vista previa no disponible</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: '#38bdf8' }}>Abrir en nueva pestaña ↗</a>
              </div>
          )}

          {tab === 'detalle' && (
            <div className="p-5">
              <DetallePanelContent doc={doc} loading={cargando} />
            </div>
          )}

          {tab === 'auditoria' && (
            <AuditoriaTimeline eventos={doc?.eventos ?? []} loading={cargando} />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
