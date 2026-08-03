'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GestorLayout from '@/components/GestorLayout';

interface DocGold {
  id: string;
  asignadoEn: string;
  notas: string | null;
  documento: {
    nombre: string;
    tipo: string;
    area: string | null;
    estado: string;
  } | null;
  cliente: { nombre: string } | null;
  expediente: { nombre: string; codigo: string | null } | null;
}

interface Cliente {
  id: string;
  nombre: string;
}

const ESTADO_COLOR: Record<string, string> = {
  LISTO: '#34d399',
  PROCESANDO: '#f59e0b',
  ERROR: '#f87171',
  ARCHIVADO: '#6b7280',
  EN_SILVER: '#818cf8',
};

const TIPO_ICON: Record<string, string> = {
  CONTRATO: '📄',
  ACTA: '📋',
  PODER: '⚖️',
  DEMANDA: '🏛️',
  FORMATO: '📑',
  DOCUMENTACION_LEGAL: '📚',
  OTRO: '🗂️',
};

function DocumentosContent() {
  const params = useSearchParams();
  const clienteIdParam = params.get('clienteId');
  const clienteNombreParam = params.get('cliente');

  const [docs, setDocs] = useState<DocGold[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState(clienteIdParam ?? '');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DocGold | null>(null);

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then((d: Cliente[]) => {
      setClientes(Array.isArray(d) ? d : []);
      // If came in by name (from old links), resolve to id
      if (clienteNombreParam && !clienteIdParam) {
        const found = d.find((c: Cliente) => c.nombre.toLowerCase() === clienteNombreParam.toLowerCase());
        if (found) setClienteId(found.id);
      }
    }).catch(() => {});
  }, [clienteIdParam, clienteNombreParam]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    const url = clienteId ? `/api/gold?clienteId=${clienteId}` : '/api/gold';
    fetch(url).then(r => r.json()).then((d: DocGold[]) => {
      setDocs(Array.isArray(d) ? d : []);
    }).catch(() => setDocs([])).finally(() => setLoading(false));
  }, [clienteId]);

  const clienteActual = clientes.find(c => c.id === clienteId);
  const totalDocs = docs.length;
  const errorDocs = docs.filter(d => d.documento?.estado === 'ERROR').length;

  return (
    <GestorLayout>
      <style>{`
        .doc-tr{border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:background .1s}
        .doc-tr:hover{background:rgba(255,255,255,0.025)}
        .doc-tr.sel{background:rgba(99,102,241,0.1)!important}
        .doc-td{padding:10px 14px;font-size:.84em;color:#94a3b8;vertical-align:middle}
        .doc-th{padding:8px 14px;font-size:.72em;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#475569;border-bottom:1px solid rgba(255,255,255,0.08);text-align:left}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href="/crm" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#475569', fontSize: '.82em', textDecoration: 'none' }}>
          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          CRM
        </Link>
        <span style={{ color: '#1e293b', fontSize: '.82em' }}>/</span>
        <h1 style={{ fontSize: '1.2em', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Documentos {clienteActual ? `— ${clienteActual.nombre}` : 'asignados'}
        </h1>
      </div>

      {/* Filters + stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <select
          value={clienteId}
          onChange={e => setClienteId(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 12px', color: '#e2e8f0', fontSize: '.83em', outline: 'none' }}
        >
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '.78em', padding: '4px 12px', borderRadius: 999, background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>
            {loading ? '—' : totalDocs} docs
          </span>
          {errorDocs > 0 && (
            <span style={{ fontSize: '.78em', padding: '4px 12px', borderRadius: 999, background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              {errorDocs} errores
            </span>
          )}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="doc-th">Documento</th>
                <th className="doc-th">Tipo</th>
                <th className="doc-th">Cliente</th>
                <th className="doc-th">Estado</th>
                <th className="doc-th">Asignado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="doc-td" style={{ textAlign: 'center', padding: 32, color: '#334155' }}>Cargando…</td></tr>
              )}
              {!loading && docs.length === 0 && (
                <tr><td colSpan={5} className="doc-td" style={{ textAlign: 'center', padding: 32, color: '#334155' }}>
                  {clienteId ? 'Este cliente no tiene documentos asignados aún.' : 'No hay documentos asignados.'}
                </td></tr>
              )}
              {docs.map(d => {
                const estado = d.documento?.estado ?? 'LISTO';
                const ec = ESTADO_COLOR[estado] ?? '#64748b';
                const tipo = d.documento?.tipo ?? 'OTRO';
                return (
                  <tr key={d.id} className={`doc-tr${selected?.id === d.id ? ' sel' : ''}`} onClick={() => setSelected(selected?.id === d.id ? null : d)}>
                    <td className="doc-td">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flexShrink: 0 }}>{TIPO_ICON[tipo] ?? '🗂️'}</span>
                        <span style={{ fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          {d.documento?.nombre ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="doc-td">
                      <span style={{ fontSize: '.78em', padding: '2px 8px', borderRadius: 999, background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>
                        {tipo}
                      </span>
                    </td>
                    <td className="doc-td">{d.cliente?.nombre ?? <span style={{ color: '#334155' }}>—</span>}</td>
                    <td className="doc-td">
                      <span style={{ fontSize: '.78em', padding: '2px 8px', borderRadius: 999, background: ec + '1a', color: ec }}>
                        {estado}
                      </span>
                    </td>
                    <td className="doc-td" style={{ color: '#475569', fontSize: '.8em' }}>
                      {new Date(d.asignadoEn).toLocaleDateString('es')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ width: 270, background: 'rgba(7,13,26,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '18px 16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '.9em' }}>Detalle</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Nombre', value: selected.documento?.nombre ?? '—', bold: true },
                { label: 'Tipo', value: selected.documento?.tipo ?? '—' },
                { label: 'Área', value: selected.documento?.area ?? '—' },
                { label: 'Estado', value: selected.documento?.estado ?? '—' },
                { label: 'Cliente', value: selected.cliente?.nombre ?? '—' },
                { label: 'Expediente', value: selected.expediente ? `${selected.expediente.nombre}${selected.expediente.codigo ? ' (' + selected.expediente.codigo + ')' : ''}` : '—' },
                { label: 'Asignado', value: new Date(selected.asignadoEn).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '.82em', gap: 8 }}>
                  <span style={{ color: '#475569', flexShrink: 0 }}>{r.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: r.bold ? 600 : 400, textAlign: 'right', wordBreak: 'break-word' }}>{r.value}</span>
                </div>
              ))}
            </div>
            {selected.notas && (
              <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '.78em', color: '#64748b', lineHeight: 1.5 }}>
                {selected.notas}
              </div>
            )}
          </div>
        )}
      </div>
    </GestorLayout>
  );
}

export default function DocumentosPage() {
  return (
    <Suspense fallback={<GestorLayout><div style={{ color: '#334155', padding: 32, textAlign: 'center' }}>Cargando…</div></GestorLayout>}>
      <DocumentosContent />
    </Suspense>
  );
}
