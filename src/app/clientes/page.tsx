'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import GestorLayout from '@/components/GestorLayout';

interface Cliente {
  id: string;
  nombre: string;
  nit: string | null;
  tipo: string;
  contacto: string | null;
  notas: string | null;
  createdAt: string;
}

interface Expediente {
  id: string;
  nombre: string;
  codigo: string | null;
  estado: string;
  radicado: string | null;
  fechaLimite: string | null;
  abogado: string | null;
  _count: { gold: number };
}

const GLASS: React.CSSProperties = {
  background: 'rgba(4,4,14,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.08)',
};
const BRAND_L = '#fbbf24';

const ESTADO_CFG: Record<string, { color: string; bg: string; label: string }> = {
  ACTIVO:     { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   label: 'Activo' },
  EN_LITIGIO: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'En litigio' },
  CERRADO:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Cerrado' },
  ARCHIVADO:  { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Archivado' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function diasRestantes(fecha?: string | null) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000);
}

function ExpedientesList({ clienteId }: { clienteId: string }) {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/expedientes?clienteId=${clienteId}`)
      .then(r => r.json())
      .then(setExpedientes)
      .finally(() => setLoading(false));
  }, [clienteId]);

  if (loading) return (
    <div className="flex justify-center py-4">
      <Loader2 className="w-4 h-4 animate-spin text-[#555]" />
    </div>
  );

  if (expedientes.length === 0) return (
    <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.45)', padding: '10px 0', fontStyle: 'italic' }}>
      Sin expedientes. Asigná documentos desde{' '}
      <Link href="/documentos/subir" style={{ color: '#818cf8', textDecoration: 'underline' }}>Subir Docs → Carga directa</Link>.
    </p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {expedientes.map(exp => {
        const est = ESTADO_CFG[exp.estado] ?? ESTADO_CFG.ACTIVO;
        const dias = diasRestantes(exp.fechaLimite);
        const vencido = dias !== null && dias < 0;
        const urgente = dias !== null && dias >= 0 && dias <= 7;
        return (
          <Link
            key={exp.id}
            href={`/expedientes/${exp.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              textDecoration: 'none', transition: 'border-color 0.15s',
            }}
            className="hover:border-[rgba(255,255,255,0.15)]"
          >
            {/* Estado dot */}
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: est.color, flexShrink: 0 }} />

            {/* Nombre + código */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {exp.codigo ? <span style={{ color: 'rgba(203,213,225,0.4)', marginRight: 5, fontSize: 11 }}>[{exp.codigo}]</span> : null}
                {exp.nombre}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', margin: '2px 0 0' }}>
                {exp.radicado ? `Rad. ${exp.radicado} · ` : ''}{exp._count.gold} doc{exp._count.gold !== 1 ? 's' : ''}
                {exp.abogado ? ` · ${exp.abogado}` : ''}
              </p>
            </div>

            {/* Estado badge */}
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: est.bg, color: est.color, border: `1px solid ${est.color}33`, flexShrink: 0 }}>
              {est.label}
            </span>

            {/* Alerta vencimiento */}
            {dias !== null && (vencido || urgente) && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, flexShrink: 0,
                background: vencido ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
                color: vencido ? '#f87171' : '#fbbf24',
                border: `1px solid ${vencido ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
                {vencido ? `Vencido ${Math.abs(dias)}d` : `${dias}d`}
              </span>
            )}

            <ChevronRight className="w-3.5 h-3.5 text-[#555] flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', nit: '', tipo: 'EMPRESA', contacto: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const cargar = () => {
    setLoading(true);
    fetch('/api/clientes').then(r => r.json()).then(setClientes).finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.nit ?? '').includes(search)
  );

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ nombre: '', nit: '', tipo: 'EMPRESA', contacto: '', notas: '' });
      setShowForm(false);
      cargar();
    } else {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Error al guardar');
    }
    setSaving(false);
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <GestorLayout>
      <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Clientes</h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: '4px 0 0' }}>
              Directorio de clientes · {clientes.length} registrados
            </p>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: BRAND_L }}>
            + Nuevo cliente
          </button>
        </div>

        {/* Formulario nuevo cliente */}
        {showForm && (
          <div className="rounded-2xl p-5 mb-6" style={{ ...GLASS }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>Nuevo cliente</h2>
            {error && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{error}</p>}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.8)', display: 'block', marginBottom: 4 }}>NOMBRE *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.8)', display: 'block', marginBottom: 4 }}>NIT / CC</label>
                <input value={form.nit} onChange={e => setForm(f => ({ ...f, nit: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.8)', display: 'block', marginBottom: 4 }}>TIPO</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(15,15,30,0.9)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }}>
                  <option value="EMPRESA">Empresa</option>
                  <option value="PERSONA_NATURAL">Persona Natural</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.8)', display: 'block', marginBottom: 4 }}>CONTACTO</label>
                <input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))}
                  placeholder="email o teléfono" className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }} />
              </div>
            </div>
            <div className="mb-4">
              <label style={{ fontSize: 11, color: 'rgba(100,116,139,0.8)', display: 'block', marginBottom: 4 }}>NOTAS</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                rows={2} className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9' }} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(148,163,184,0.8)' }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: BRAND_L, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar cliente'}
              </button>
            </div>
          </div>
        )}

        {/* Búsqueda */}
        <div className="mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o NIT..."
            className="w-full rounded-xl px-4 py-2.5 text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }} />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: '#f59e0b' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'rgba(100,116,139,0.5)', fontSize: 14 }}>
            {search ? 'Sin resultados' : 'No hay clientes registrados aún'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtrados.map(c => {
              const isOpen = expanded.has(c.id);
              return (
                <div key={c.id} className="rounded-xl overflow-hidden" style={{ ...GLASS }}>
                  {/* Cliente row */}
                  <button
                    onClick={() => toggleExpanded(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left"
                  >
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.15)', color: BRAND_L }}>
                      {c.nombre[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{c.nombre}</p>
                      <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.7)', margin: '2px 0 0' }}>
                        {c.tipo === 'EMPRESA' ? '🏢 Empresa' : '👤 Persona Natural'}
                        {c.nit ? ` · NIT: ${c.nit}` : ''}
                        {c.contacto ? ` · ${c.contacto}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {c.notas && (
                        <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', maxWidth: 180 }} className="line-clamp-1 hidden sm:block">{c.notas}</p>
                      )}
                      <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.4)' }}>{fmt(c.createdAt)}</span>
                      {isOpen
                        ? <ChevronDown className="w-4 h-4 text-[#555]" />
                        : <ChevronRight className="w-4 h-4 text-[#555]" />}
                    </div>
                  </button>

                  {/* Expedientes expandibles */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(100,116,139,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Expedientes
                        </span>
                      </div>
                      <ExpedientesList clienteId={c.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GestorLayout>
  );
}
