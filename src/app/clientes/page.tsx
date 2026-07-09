'use client';

import { useEffect, useState } from 'react';
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

const GLASS: React.CSSProperties = {
  background: 'rgba(4,4,14,0.55)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.08)',
};
const BRAND = '#f59e0b';
const BRAND_L = '#fbbf24';
const FONT = "'Inter', system-ui, sans-serif";

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', nit: '', tipo: 'EMPRESA', contacto: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <GestorLayout>
      <div style={{ padding: '24px', fontFamily: FONT, maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Clientes</h1>
            <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', margin: '4px 0 0' }}>
              Directorio de clientes de la firma · {clientes.length} registrados
            </p>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: `rgba(245,158,11,0.15)`, border: `1px solid rgba(245,158,11,0.3)`, color: BRAND_L }}
          >
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
                  placeholder="email o teléfono"
                  className="w-full rounded-lg px-3 py-2 text-sm"
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
                style={{ background: 'rgba(245,158,11,0.2)', border: `1px solid rgba(245,158,11,0.4)`, color: BRAND_L, opacity: saving ? 0.6 : 1 }}>
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
            <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: BRAND }} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'rgba(100,116,139,0.5)', fontSize: 14 }}>
            {search ? 'Sin resultados' : 'No hay clientes registrados aún'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtrados.map(c => (
              <div key={c.id} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ ...GLASS }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.15)', color: BRAND_L }}>
                    {c.nombre[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{c.nombre}</p>
                    <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.7)', margin: '2px 0 0' }}>
                      {c.tipo === 'EMPRESA' ? '🏢' : '👤'} {c.tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                      {c.nit ? ` · NIT: ${c.nit}` : ''}
                      {c.contacto ? ` · ${c.contacto}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.notas && (
                    <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', maxWidth: 200 }} className="line-clamp-1">{c.notas}</p>
                  )}
                  <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.4)' }}>{fmt(c.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GestorLayout>
  );
}
