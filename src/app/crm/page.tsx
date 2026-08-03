'use client';

import { useEffect, useState } from 'react';
import GestorLayout from '@/components/GestorLayout';
import Link from 'next/link';

interface Cliente {
  id: string;
  nombre: string;
  nit?: string | null;
  tipo: string;
  contacto?: string | null;
  notas?: string | null;
  createdAt: string;
}

interface DocResumen {
  total: number;
  byCliente: Record<string, number>;
}

const TIPO_COLOR: Record<string, string> = {
  EMPRESA: '#818cf8',
  PERSONA: '#34d399',
  GOBIERNO: '#f59e0b',
};

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 20px', minWidth: 120 }}>
      <div style={{ fontSize: '1.65em', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '.75em', color: '#475569', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function CRMPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [docResumen, setDocResumen] = useState<DocResumen>({ total: 0, byCliente: {} });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ nombre: '', nit: '', tipo: 'EMPRESA', contacto: '', notas: '' });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/documentos?limit=200'),
      ]);
      const cData: Cliente[] = await cRes.json();
      const dData = await dRes.json();
      const docs: { clienteId?: string }[] = dData.documentos ?? dData ?? [];
      const byCliente: Record<string, number> = {};
      docs.forEach(d => { if (d.clienteId) byCliente[d.clienteId] = (byCliente[d.clienteId] ?? 0) + 1; });
      setClientes(cData);
      setDocResumen({ total: docs.length, byCliente });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setSaveErr('El nombre es obligatorio'); return; }
    setSaving(true); setSaveErr('');
    try {
      const r = await fetch('/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) { const d = await r.json(); setSaveErr(d.error ?? 'Error'); return; }
      setAddOpen(false);
      setForm({ nombre: '', nit: '', tipo: 'EMPRESA', contacto: '', notas: '' });
      await fetchData();
    } catch { setSaveErr('Error de red'); }
    finally { setSaving(false); }
  };

  const totalClientes = clientes.length;
  const totalDocs = docResumen.total;
  const empresas = clientes.filter(c => c.tipo === 'EMPRESA').length;

  return (
    <GestorLayout>
      <style>{`
        .crm-table{width:100%;border-collapse:collapse}
        .crm-tr{border-bottom:1px solid rgba(255,255,255,0.05);transition:background .12s;cursor:pointer}
        .crm-tr:hover{background:rgba(255,255,255,0.025)}
        .crm-tr.sel{background:rgba(99,102,241,0.1)!important}
        .crm-td{padding:10px 14px;font-size:.84em;color:#94a3b8;vertical-align:middle}
        .crm-th{padding:8px 14px;font-size:.72em;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#475569;border-bottom:1px solid rgba(255,255,255,0.08);text-align:left}
        .crm-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:.7em;font-weight:600}
        .crm-input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:8px 12px;color:#e2e8f0;font-size:.85em;outline:none;box-sizing:border-box;transition:border-color .15s}
        .crm-input:focus{border-color:#818cf8}
        .crm-select{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:8px 12px;color:#e2e8f0;font-size:.85em;outline:none;box-sizing:border-box}
        @media(max-width:767px){.crm-stats{flex-wrap:wrap}.crm-detail-panel{position:fixed;inset:0;z-index:50;border-radius:0!important;overflow-y:auto}}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.45em', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>CRM — Clientes</h1>
          <p style={{ fontSize: '.82em', color: '#475569', margin: '2px 0 0' }}>Datos reales de la base de datos</p>
        </div>
        <button onClick={() => { setAddOpen(true); setSaveErr(''); }} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: '.85em', cursor: 'pointer' }}>
          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo cliente
        </button>
      </div>

      {/* Stats */}
      <div className="crm-stats" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <Stat label="Clientes totales" value={loading ? '—' : totalClientes} color="#818cf8" />
        <Stat label="Empresas" value={loading ? '—' : empresas} color="#60a5fa" />
        <Stat label="Documentos procesados" value={loading ? '—' : totalDocs} color="#34d399" />
        <Stat label="Estado sistema" value="Activo" color="#22c55e" />
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">Cliente</th>
                <th className="crm-th">Tipo</th>
                <th className="crm-th">Contacto</th>
                <th className="crm-th">Docs</th>
                <th className="crm-th">Alta</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="crm-td" style={{ textAlign: 'center', padding: '32px', color: '#334155' }}>Cargando…</td></tr>
              )}
              {!loading && clientes.length === 0 && (
                <tr><td colSpan={5} className="crm-td" style={{ textAlign: 'center', padding: '32px', color: '#334155' }}>
                  No hay clientes. Agregá el primero.
                </td></tr>
              )}
              {clientes.map(c => {
                const tc = TIPO_COLOR[c.tipo] ?? '#94a3b8';
                const docs = docResumen.byCliente[c.id] ?? 0;
                const initials = c.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={c.id} className={`crm-tr${selected?.id === c.id ? ' sel' : ''}`} onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                    <td className="crm-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: tc + '22', border: '1px solid ' + tc + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72em', fontWeight: 700, color: tc, flexShrink: 0 }}>{initials}</div>
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.nombre}</span>
                      </div>
                    </td>
                    <td className="crm-td">
                      <span className="crm-badge" style={{ background: tc + '1a', color: tc }}>{c.tipo}</span>
                    </td>
                    <td className="crm-td">{c.contacto ?? <span style={{ color: '#334155' }}>—</span>}</td>
                    <td className="crm-td">
                      <span style={{ fontWeight: 700, color: docs > 0 ? '#34d399' : '#475569' }}>{docs}</span>
                    </td>
                    <td className="crm-td" style={{ color: '#475569', fontSize: '.8em' }}>{new Date(c.createdAt).toLocaleDateString('es')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="crm-detail-panel" style={{ width: 280, background: 'rgba(10,17,32,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 18px', flexShrink: 0, backdropFilter: 'blur(8px)' }}>
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '1.1em' }}>✕</button>
            {(() => {
              const c = selected;
              const tc = TIPO_COLOR[c.tipo] ?? '#94a3b8';
              const initials = c.nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
              const docs = docResumen.byCliente[c.id] ?? 0;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: tc + '22', border: '1px solid ' + tc + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.95em', fontWeight: 800, color: tc }}>{initials}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '1em' }}>{c.nombre}</div>
                      <div style={{ fontSize: '.72em', color: '#475569', marginTop: 2 }}>{c.id.slice(-8)}</div>
                    </div>
                  </div>

                  {[
                    { label: 'Tipo', value: c.tipo },
                    { label: 'NIT', value: c.nit ?? '—' },
                    { label: 'Contacto', value: c.contacto ?? '—' },
                    { label: 'Documentos', value: String(docs) },
                    { label: 'Alta', value: new Date(c.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '.83em' }}>
                      <span style={{ color: '#475569' }}>{r.label}</span>
                      <span style={{ color: '#e2e8f0', fontWeight: r.label === 'Documentos' ? 700 : 400 }}>{r.value}</span>
                    </div>
                  ))}

                  {c.notas && (
                    <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '.8em', color: '#64748b', lineHeight: 1.5 }}>{c.notas}</div>
                  )}

                  <Link href={`/documentos?clienteId=${c.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, padding: '9px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, color: '#818cf8', fontSize: '.8em', fontWeight: 600, textDecoration: 'none' }}>
                    <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Ver documentos
                  </Link>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Add modal */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div style={{ background: '#0d1829', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontSize: '1.1em', fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' }}>Nuevo cliente</h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '.78em', color: '#64748b', display: 'block', marginBottom: 5 }}>Nombre *</label>
                <input className="crm-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del cliente" />
              </div>
              <div>
                <label style={{ fontSize: '.78em', color: '#64748b', display: 'block', marginBottom: 5 }}>NIT</label>
                <input className="crm-input" value={form.nit} onChange={e => setForm(p => ({ ...p, nit: e.target.value }))} placeholder="Opcional" />
              </div>
              <div>
                <label style={{ fontSize: '.78em', color: '#64748b', display: 'block', marginBottom: 5 }}>Tipo</label>
                <select className="crm-select" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="EMPRESA">Empresa</option>
                  <option value="PERSONA">Persona natural</option>
                  <option value="GOBIERNO">Gobierno</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '.78em', color: '#64748b', display: 'block', marginBottom: 5 }}>Contacto</label>
                <input className="crm-input" value={form.contacto} onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} placeholder="Email o teléfono" />
              </div>
              <div>
                <label style={{ fontSize: '.78em', color: '#64748b', display: 'block', marginBottom: 5 }}>Notas</label>
                <textarea className="crm-input" value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Notas internas" rows={2} style={{ resize: 'vertical' }} />
              </div>
              {saveErr && <div style={{ fontSize: '.8em', color: '#f87171', padding: '6px 10px', background: 'rgba(248,113,113,0.1)', borderRadius: 6 }}>{saveErr}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setAddOpen(false)} style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: '.85em' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '9px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontSize: '.85em', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando…' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </GestorLayout>
  );
}
