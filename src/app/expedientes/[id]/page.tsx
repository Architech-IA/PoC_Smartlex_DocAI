'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Save, Sparkles, AlertTriangle, FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import GestorLayout from '@/components/GestorLayout'

// ── Types ────────────────────────────────────────────────────────────────────

interface Partes {
  demandante?: string
  demandado?: string
  apoderado?: string
  contraparte?: string
}

interface DocResumen {
  id: string
  nombre: string
  tipo: string
  area?: string | null
  estado: string
  resumen?: string | null
  tamanoBytes?: number | null
  createdAt: string
}

interface GoldItem {
  id: string
  asignadoEn: string
  documento: DocResumen
}

interface Expediente {
  id: string
  nombre: string
  codigo?: string | null
  descripcion?: string | null
  estado: string
  abogado?: string | null
  radicado?: string | null
  fechaInicio?: string | null
  fechaCierre?: string | null
  fechaLimite?: string | null
  partes?: Partes | null
  resumenIA?: string | null
  documentosFaltantes?: string[] | null
  ultimoAnalisis?: string | null
  cliente: { id: string; nombre: string; nit?: string | null }
  gold: GoldItem[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVO:     { label: 'Activo',      color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  EN_LITIGIO: { label: 'En litigio',  color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  CERRADO:    { label: 'Cerrado',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  ARCHIVADO:  { label: 'Archivado',   color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

const TIPO_COLOR: Record<string, string> = {
  CONTRATO: '#60a5fa', ACTA: '#86efac', PODER: '#a78bfa',
  DEMANDA: '#f87171', FORMATO: '#fbbf24', DOCUMENTACION_LEGAL: '#5eead4', OTRO: '#94a3b8',
}

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasRestantes(fecha?: string | null): number | null {
  if (!fecha) return null
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000)
}

// ── Input helper ─────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0', outline: 'none',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'rgba(100,116,139,0.6)', display: 'block', marginBottom: 4,
}
const sectionHead = (title: string, icon?: React.ReactNode) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
    {icon}
    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(203,213,225,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
  </div>
)

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExpedientePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Expediente | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    nombre: '', descripcion: '', estado: 'ACTIVO', abogado: '',
    radicado: '', fechaInicio: '', fechaCierre: '', fechaLimite: '',
    demandante: '', demandado: '', apoderado: '', contraparte: '',
  })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    fetch(`/api/expedientes/${id}`)
      .then(r => r.json())
      .then((d: Expediente) => {
        setData(d)
        const p = d.partes ?? {}
        setForm({
          nombre: d.nombre ?? '',
          descripcion: d.descripcion ?? '',
          estado: d.estado ?? 'ACTIVO',
          abogado: d.abogado ?? '',
          radicado: d.radicado ?? '',
          fechaInicio: d.fechaInicio ? d.fechaInicio.split('T')[0] : '',
          fechaCierre: d.fechaCierre ? d.fechaCierre.split('T')[0] : '',
          fechaLimite: d.fechaLimite ? d.fechaLimite.split('T')[0] : '',
          demandante: p.demandante ?? '',
          demandado: p.demandado ?? '',
          apoderado: p.apoderado ?? '',
          contraparte: p.contraparte ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  const guardar = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/expedientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          estado: form.estado,
          abogado: form.abogado || null,
          radicado: form.radicado || null,
          fechaInicio: form.fechaInicio || null,
          fechaCierre: form.fechaCierre || null,
          fechaLimite: form.fechaLimite || null,
          partes: {
            demandante: form.demandante || undefined,
            demandado: form.demandado || undefined,
            apoderado: form.apoderado || undefined,
            contraparte: form.contraparte || undefined,
          },
        }),
      })
      const updated = await res.json() as Expediente
      setData(prev => prev ? { ...prev, ...updated } : prev)
      setEditando(false)
      showToast('Expediente guardado ✓')
    } finally { setSaving(false) }
  }

  const analizar = async () => {
    setAnalizando(true)
    try {
      const res = await fetch(`/api/expedientes/${id}/analizar`, { method: 'POST' })
      const result = await res.json() as { resumenIA?: string; documentosFaltantes?: string[]; ultimoAnalisis?: string; error?: string }
      if (!res.ok) { showToast(`Error: ${result.error ?? 'desconocido'}`); return }
      setData(prev => prev ? { ...prev, resumenIA: result.resumenIA ?? null, documentosFaltantes: result.documentosFaltantes ?? null, ultimoAnalisis: result.ultimoAnalisis ?? null } : prev)
      showToast('Análisis IA completado ✓')
    } finally { setAnalizando(false) }
  }

  if (loading) return (
    <GestorLayout activeHref="/clientes">
      <div className="flex justify-center mt-20"><Loader2 className="w-6 h-6 animate-spin text-[#555]" /></div>
    </GestorLayout>
  )
  if (!data) return (
    <GestorLayout activeHref="/clientes">
      <p className="text-center text-[#555] mt-20">Expediente no encontrado.</p>
    </GestorLayout>
  )

  const estadoCfg = ESTADO_CFG[data.estado] ?? ESTADO_CFG.ACTIVO
  const dias = diasRestantes(data.fechaLimite)
  const vencido = dias !== null && dias < 0
  const urgente = dias !== null && dias >= 0 && dias <= 7

  return (
    <GestorLayout activeHref="/clientes">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#555]">
          <Link href="/" className="hover:text-[#aaa] transition-colors">Inicio</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/clientes" className="hover:text-[#aaa] transition-colors">Clientes</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[#aaa]">{data.cliente.nombre}</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-white">{data.nombre}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-white">{data.nombre}</h1>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: estadoCfg.bg, color: estadoCfg.color, border: `1px solid ${estadoCfg.color}33` }}>
                {estadoCfg.label}
              </span>
            </div>
            <p className="text-sm text-[#555]">
              {data.cliente.nombre}{data.codigo ? ` · ${data.codigo}` : ''}{data.radicado ? ` · Rad. ${data.radicado}` : ''}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setEditando(!editando)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: editando ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${editando ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.1)'}`, color: editando ? '#818cf8' : '#aaa' }}>
              {editando ? 'Cancelar' : '✎ Editar'}
            </button>
            {editando && (
              <button onClick={guardar} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            )}
          </div>
        </div>

        {/* Alerta de vencimiento */}
        {dias !== null && (vencido || urgente) && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: vencido ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${vencido ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: vencido ? '#f87171' : '#fbbf24' }} />
            <span style={{ fontSize: 13, color: vencido ? '#f87171' : '#fbbf24' }}>
              {vencido
                ? `⚠ Fecha límite vencida hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''} (${fmt(data.fechaLimite)})`
                : `⏰ La fecha límite vence en ${dias} día${dias !== 1 ? 's' : ''} (${fmt(data.fechaLimite)})`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Metadata ─────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Info del caso */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {sectionHead('Información del caso')}
              {editando ? (
                <div className="space-y-3">
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={labelStyle}>Radicado</label>
                      <input value={form.radicado} onChange={e => setForm(p => ({ ...p, radicado: e.target.value }))} style={inputStyle} placeholder="Nro. de radicado" />
                    </div>
                    <div>
                      <label style={labelStyle}>Estado</label>
                      <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                        style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                        <option value="ACTIVO">Activo</option>
                        <option value="EN_LITIGIO">En litigio</option>
                        <option value="CERRADO">Cerrado</option>
                        <option value="ARCHIVADO">Archivado</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Abogado responsable</label>
                    <input value={form.abogado} onChange={e => setForm(p => ({ ...p, abogado: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Descripción</label>
                    <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </div>
              ) : (
                <div style={{ ...{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' } }}>
                  {[
                    ['Radicado', data.radicado],
                    ['Abogado', data.abogado],
                    ['Descripción', data.descripcion],
                  ].filter(([, v]) => v).map(([k, v], i, arr) => (
                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fechas */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {sectionHead('Fechas', <Clock className="w-3.5 h-3.5 text-[#555]" />)}
              {editando ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { lbl: 'Apertura', key: 'fechaInicio' as const },
                    { lbl: 'Cierre', key: 'fechaCierre' as const },
                    { lbl: 'Límite procesal', key: 'fechaLimite' as const },
                  ].map(({ lbl, key }) => (
                    <div key={key}>
                      <label style={labelStyle}>{lbl}</label>
                      <input type="date" value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
                  {[
                    ['Apertura', fmt(data.fechaInicio)],
                    ['Cierre esperado', fmt(data.fechaCierre)],
                    ['Límite procesal', data.fechaLimite
                      ? <span style={{ color: vencido ? '#f87171' : urgente ? '#fbbf24' : '#cbd5e1' }}>
                          {fmt(data.fechaLimite)}{dias !== null ? ` (${dias < 0 ? `vencido ${Math.abs(dias)}d` : `${dias}d restantes`})` : ''}
                        </span>
                      : '—'],
                  ].map(([k, v], i) => (
                    <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Partes */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {sectionHead('Partes involucradas')}
              {editando ? (
                <div className="space-y-2">
                  {[
                    { lbl: 'Demandante', key: 'demandante' as const },
                    { lbl: 'Demandado', key: 'demandado' as const },
                    { lbl: 'Apoderado', key: 'apoderado' as const },
                    { lbl: 'Contraparte', key: 'contraparte' as const },
                  ].map(({ lbl, key }) => (
                    <div key={key}>
                      <label style={labelStyle}>{lbl}</label>
                      <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} placeholder={`Nombre del ${lbl.toLowerCase()}`} />
                    </div>
                  ))}
                </div>
              ) : (
                (() => {
                  const partes = data.partes ?? {}
                  const items = [
                    ['Demandante', partes.demandante],
                    ['Demandado', partes.demandado],
                    ['Apoderado', partes.apoderado],
                    ['Contraparte', partes.contraparte],
                  ].filter(([, v]) => v)
                  return items.length > 0 ? (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
                      {items.map(([k, v], i) => (
                        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <span style={{ fontSize: 11, color: 'rgba(100,116,139,0.6)', flexShrink: 0 }}>{k}</span>
                          <span style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'right' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.4)', fontStyle: 'italic' }}>Sin partes registradas. Editá para agregar.</p>
                  )
                })()
              )}
            </div>
          </div>

          {/* ── IA + Documentos ──────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* IA del expediente */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.15)' }}>
              <div className="flex items-center justify-between">
                {sectionHead('Análisis IA del Expediente', <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" />)}
                <button onClick={analizar} disabled={analizando || data.gold.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 mb-3 transition-all"
                  style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8', opacity: (analizando || data.gold.length === 0) ? 0.5 : 1, cursor: (analizando || data.gold.length === 0) ? 'not-allowed' : 'pointer' }}>
                  {analizando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {analizando ? 'Analizando…' : 'Generar análisis'}
                </button>
              </div>

              {data.gold.length === 0 && (
                <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', fontStyle: 'italic' }}>Asigná documentos al expediente para poder generar el análisis.</p>
              )}

              {data.resumenIA ? (
                <div style={{ borderLeft: '2px solid rgba(129,140,248,0.4)', paddingLeft: 10 }}>
                  <p style={{ fontSize: 11, color: 'rgba(203,213,225,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{data.resumenIA}</p>
                  {data.ultimoAnalisis && (
                    <p style={{ fontSize: 10, color: 'rgba(100,116,139,0.45)', marginTop: 6 }}>Último análisis: {fmt(data.ultimoAnalisis)}</p>
                  )}
                </div>
              ) : data.gold.length > 0 && (
                <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.5)', fontStyle: 'italic' }}>
                  No hay análisis generado. Hacé clic en "Generar análisis" para que la IA revise todos los documentos del expediente.
                </p>
              )}

              {/* Documentos faltantes */}
              {(data.documentosFaltantes as string[] | null | undefined)?.length ? (
                <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Documentos faltantes detectados</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {(data.documentosFaltantes as string[]).map((d, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: 11, color: 'rgba(248,113,113,0.8)' }}>
                        <span style={{ flexShrink: 0, marginTop: 2 }}>⚠</span>{d}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* Documentos del expediente */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {sectionHead(`Documentos (${data.gold.length})`, <FileText className="w-3.5 h-3.5 text-[#555]" />)}
              {data.gold.length === 0 ? (
                <p style={{ fontSize: 11, color: 'rgba(100,116,139,0.4)', fontStyle: 'italic' }}>
                  Sin documentos asignados. Usá la Carga directa en <Link href="/documentos/subir" style={{ color: '#818cf8', textDecoration: 'underline' }}>Subir Docs</Link>.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.gold.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: TIPO_COLOR[g.documento.tipo] ?? '#94a3b8', flexShrink: 0 }}>
                        {g.documento.tipo}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{g.documento.nombre}</p>
                        {g.documento.resumen && (
                          <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.documento.resumen}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)' }}>{fmt(g.asignadoEn)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: '#1a1a2e', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
          {toast}
        </div>
      )}
    </GestorLayout>
  )
}
