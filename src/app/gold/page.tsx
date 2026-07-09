'use client';

import { useCallback, useEffect, useState } from 'react';
import GestorLayout from '@/components/GestorLayout';

interface DocPendiente {
  id: string;
  nombre: string;
  tipo: string;
  area: string | null;
  resumen: string | null;
  socio: string | null;
  createdAt: string;
}

interface Cliente {
  id: string;
  nombre: string;
  tipo: string;
}

interface Sugerencia {
  clienteId: string;
  nombre: string;
  similitud: number;
}

const GLASS: React.CSSProperties = {
  background: 'rgba(4,4,14,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.08)',
};
const BRAND = '#f59e0b';
const BRAND_L = '#fbbf24';
const FONT = "'Inter', system-ui, sans-serif";

const TIPO_COLOR: Record<string, string> = {
  CONTRATO: '#fbbf24', ACTA: '#34d399', PODER: '#818cf8',
  DEMANDA: '#f87171', FORMATO: '#22d3ee', DOCUMENTACION_LEGAL: '#a78bfa', OTRO: '#64748b',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GoldPage() {
  const [pendientes, setPendientes] = useState<DocPendiente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocPendiente | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [notas, setNotas] = useState('');
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/gold?pendientes=1').then(r => r.json()),
      fetch('/api/clientes').then(r => r.json()),
    ]).then(([docs, cls]) => {
      setPendientes(docs as DocPendiente[]);
      setClientes(cls as Cliente[]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const seleccionar = async (doc: DocPendiente) => {
    setSelected(doc);
    setClienteId('');
    setNotas('');
    setSugerencias([]);
    setLoadingSug(true);
    try {
      const res = await fetch(`/api/gold/sugerir?documentoId=${doc.id}`);
      const data = await res.json() as { sugerencias: Sugerencia[] };
      setSugerencias(data.sugerencias ?? []);
    } finally {
      setLoadingSug(false);
    }
  };

  const asignar = async () => {
    if (!selected || !clienteId) return;
    setAsignando(true);
    const res = await fetch('/api/gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentoId: selected.id, clienteId, asignadoPor: 'abogado', notas }),
    });
    if (res.ok) {
      showToast('Documento asignado a cliente ✓');
      setSelected(null);
      cargar();
    } else {
      showToast('Error al asignar', false);
    }
    setAsignando(false);
  };

  return (
    <GestorLayout>
      <div style={{ padding: '24px', fontFamily: FONT, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: toast.ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              border: `1px solid ${toast.ok ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              color: toast.ok ? '#34d399' : '#f87171' }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>🥇 Asignación a Clientes</h1>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: '4px 0 0' }}>
            Documentos procesados pendientes de asignación · {pendientes.length} en cola
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Lista pendientes */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: BRAND }} />
              </div>
            ) : pendientes.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ ...GLASS, color: 'rgba(100,116,139,0.5)', fontSize: 14 }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🎉</p>
                Todos los documentos están asignados
              </div>
            ) : pendientes.map(doc => (
              <button key={doc.id} onClick={() => seleccionar(doc)} className="text-left rounded-xl px-4 py-3 transition-all"
                style={{
                  ...GLASS,
                  border: selected?.id === doc.id ? `1px solid rgba(245,158,11,0.4)` : '1px solid rgba(255,255,255,0.08)',
                  background: selected?.id === doc.id ? 'rgba(245,158,11,0.06)' : 'rgba(4,4,14,0.55)',
                }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${TIPO_COLOR[doc.tipo] ?? '#64748b'}18`, color: TIPO_COLOR[doc.tipo] ?? '#64748b',
                          border: `1px solid ${TIPO_COLOR[doc.tipo] ?? '#64748b'}33` }}>
                        {doc.tipo}
                      </span>
                      {doc.area && <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)' }}>{doc.area}</span>}
                      {doc.socio && (
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.2)' }}>
                          {doc.socio}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: '0 0 4px' }} className="truncate">{doc.nombre}</p>
                    {doc.resumen && (
                      <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', lineHeight: 1.5 }} className="line-clamp-2">{doc.resumen}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.4)', flexShrink: 0, marginLeft: 8 }}>{fmt(doc.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Panel de asignación */}
          {selected && (
            <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="rounded-2xl p-4" style={{ ...GLASS }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: BRAND_L, marginBottom: 12 }}>Asignar a cliente</h2>

                {/* Sugerencias IA */}
                {loadingSug && (
                  <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.6)', marginBottom: 10 }}>⏳ Calculando sugerencias...</p>
                )}
                {!loadingSug && sugerencias.length > 0 && (
                  <div className="mb-3">
                    <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', marginBottom: 6, fontWeight: 600 }}>SUGERENCIAS IA</p>
                    <div className="flex flex-col gap-1.5">
                      {sugerencias.map(s => (
                        <button key={s.clienteId} onClick={() => setClienteId(s.clienteId)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all"
                          style={{
                            background: clienteId === s.clienteId ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${clienteId === s.clienteId ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`,
                          }}>
                          <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{s.nombre}</span>
                          <span style={{ fontSize: 11, color: '#34d399' }}>{Math.round(s.similitud * 100)}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selector cliente */}
                <div className="mb-3">
                  <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.7)', display: 'block', marginBottom: 5, fontWeight: 600 }}>
                    CLIENTE *
                  </label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: clienteId ? '#f1f5f9' : '#475569' }}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Notas */}
                <div className="mb-4">
                  <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.7)', display: 'block', marginBottom: 5, fontWeight: 600 }}>
                    NOTAS (opcional)
                  </label>
                  <textarea value={notas} onChange={e => setNotas(e.target.value)}
                    rows={2} placeholder="Observaciones sobre esta asignación..."
                    className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }} />
                </div>

                <button onClick={asignar} disabled={!clienteId || asignando}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: clienteId ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${clienteId ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    color: clienteId ? BRAND_L : '#475569',
                    cursor: clienteId ? 'pointer' : 'not-allowed',
                  }}>
                  {asignando ? 'Asignando...' : '🥇 Confirmar asignación'}
                </button>
              </div>

              {/* Info del doc seleccionado */}
              <div className="rounded-2xl p-4" style={{ ...GLASS }}>
                <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', fontWeight: 600, marginBottom: 8 }}>DOCUMENTO SELECCIONADO</p>
                <p style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 6 }}>{selected.nombre}</p>
                {selected.resumen && (
                  <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.65)', lineHeight: 1.6 }}>{selected.resumen.slice(0, 200)}{selected.resumen.length > 200 ? '…' : ''}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </GestorLayout>
  );
}
