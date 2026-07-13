'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface ExpedienteDetalle {
  id: string
  nombre: string
  codigo?: string | null
  estado: string
  radicado?: string | null
  abogado?: string | null
  descripcion?: string | null
  fechaInicio?: string | null
  fechaCierre?: string | null
  fechaLimite?: string | null
  partes?: { demandante?: string; demandado?: string; apoderado?: string; contraparte?: string } | null
  resumenIA?: string | null
  documentosFaltantes?: string[] | null
  ultimoAnalisis?: string | null
  cliente: { id: string; nombre: string }
  gold: {
    id: string
    asignadoEn: string
    documento: { id: string; nombre: string; tipo: string; area?: string | null; resumen?: string | null }
  }[]
}

const EXP_ESTADO: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVO:     { label: 'Activo',     color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  EN_LITIGIO: { label: 'En litigio', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  CERRADO:    { label: 'Cerrado',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  ARCHIVADO:  { label: 'Archivado',  color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

const TIPO_CLR: Record<string, string> = {
  CONTRATO: '#60a5fa', ACTA: '#86efac', PODER: '#a78bfa',
  DEMANDA: '#f87171', FORMATO: '#fbbf24', DOCUMENTACION_LEGAL: '#5eead4', OTRO: '#94a3b8',
}

function fmtFecha(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function calcDias(fecha?: string | null): number | null {
  if (!fecha) return null
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000)
}

type TabKey = 'info' | 'docs' | 'ia'

interface Props {
  expId: string
  onClose: () => void
}

export default function ExpedienteModal({ expId, onClose }: Props) {
  const [data, setData] = React.useState<ExpedienteDetalle | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [analizando, setAnalizando] = React.useState(false)
  const [tab, setTab] = React.useState<TabKey>('info')

  React.useEffect(() => {
    setLoading(true)
    fetch('/api/expedientes/' + expId)
      .then(r => r.json())
      .then(d => setData(d as ExpedienteDetalle))
      .finally(() => setLoading(false))
  }, [expId])

  const analizar = async () => {
    if (!data) return
    setAnalizando(true)
    try {
      const res = await fetch('/api/expedientes/' + expId + '/analizar', { method: 'POST' })
      const result = await res.json() as { resumenIA?: string; documentosFaltantes?: string[]; ultimoAnalisis?: string }
      setData(prev => prev ? { ...prev, resumenIA: result.resumenIA ?? null, documentosFaltantes: result.documentosFaltantes ?? null, ultimoAnalisis: result.ultimoAnalisis ?? null } : prev)
    } finally { setAnalizando(false) }
  }

  const est = data ? (EXP_ESTADO[data.estado] ?? EXP_ESTADO.ACTIVO) : null
  const dias = data ? calcDias(data.fechaLimite) : null
  const vencido = dias !== null && dias < 0
  const urgente = dias !== null && dias >= 0 && dias <= 7

  const rowBorder = '1px solid rgba(255,255,255,0.04)'
  const cardBase: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }
  const kStyle: React.CSSProperties = { fontSize: 11, color: 'rgba(100,116,139,0.6)', flexShrink: 0, paddingTop: 1 }
  const vStyle: React.CSSProperties = { fontSize: 11, color: '#cbd5e1', textAlign: 'right' }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'info', label: 'Información' },
    { key: 'docs', label: 'Documentos' + (data ? ' (' + data.gold.length + ')' : '') },
    { key: 'ia', label: 'Análisis IA' },
  ]

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
    >
      <div style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', borderRadius: 16, display: 'flex', flexDirection: 'column', background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          {loading
            ? <p style={{ fontSize: 13, color: '#555' }}>Cargando…</p>
            : data
              ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{data.nombre}</span>
                    {est && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: est.bg, color: est.color, border: '1px solid ' + est.color + '33' }}>{est.label}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.7)', margin: 0 }}>
                    {data.cliente.nombre}{data.codigo ? ' · ' + data.codigo : ''}{data.radicado ? ' · Rad. ' + data.radicado : ''}
                  </p>
                </div>
              )
              : <p style={{ fontSize: 13, color: '#f87171' }}>Error al cargar</p>
          }
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {data && (
              <a href={'/expedientes/' + data.id} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'rgba(129,140,248,0.7)', textDecoration: 'none', padding: '4px 8px', borderRadius: 6, background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)' }}>
                Abrir página ↗
              </a>
            )}
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>

        {/* Alerta vencimiento */}
        {!loading && (vencido || urgente) && (
          <div style={{ padding: '8px 20px', background: vencido ? 'rgba(248,113,113,0.07)' : 'rgba(251,191,36,0.07)', borderBottom: '1px solid ' + (vencido ? 'rgba(248,113,113,0.2)' : 'rgba(251,191,36,0.2)'), fontSize: 12, color: vencido ? '#f87171' : '#fbbf24' }}>
            {vencido
              ? '⚠ Fecha límite vencida hace ' + Math.abs(dias!) + 'd (' + fmtFecha(data?.fechaLimite) + ')'
              : '⏰ Vence en ' + dias + 'd (' + fmtFecha(data?.fechaLimite) + ')'}
          </div>
        )}

        {/* Tabs */}
        {!loading && data && (
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '10px 16px', fontSize: 12, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? '#f1f5f9' : 'rgba(100,116,139,0.6)', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #fbbf24' : '2px solid transparent', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
              <Loader2 className="w-6 h-6 animate-spin text-[#555]" />
            </div>
          )}

          {/* Tab: info */}
          {!loading && data && tab === 'info' && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={cardBase}>
                {[['Radicado', data.radicado], ['Abogado', data.abogado], ['Descripción', data.descripcion]].filter(row => row[1]).map((row, i, arr) => (
                  <div key={String(row[0])} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderBottom: i < arr.length - 1 ? rowBorder : 'none', alignItems: 'flex-start' }}>
                    <span style={kStyle}>{row[0]}</span><span style={vStyle}>{row[1]}</span>
                  </div>
                ))}
                {!data.radicado && !data.abogado && !data.descripcion && (
                  <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.4)', padding: '12px 10px', fontStyle: 'italic', margin: 0 }}>Sin información adicional.</p>
                )}
              </div>

              <div style={cardBase}>
                {[
                  { k: 'Apertura', v: fmtFecha(data.fechaInicio) },
                  { k: 'Cierre esperado', v: fmtFecha(data.fechaCierre) },
                  { k: 'Límite procesal', v: data.fechaLimite ? fmtFecha(data.fechaLimite) + (dias !== null ? ' (' + (dias < 0 ? 'vencido ' + Math.abs(dias) + 'd' : dias + 'd restantes') + ')' : '') : '—' },
                ].map((row, i) => (
                  <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderBottom: i < 2 ? rowBorder : 'none', alignItems: 'flex-start' }}>
                    <span style={kStyle}>{row.k}</span>
                    <span style={{ ...vStyle, color: row.k === 'Límite procesal' && vencido ? '#f87171' : row.k === 'Límite procesal' && urgente ? '#fbbf24' : '#cbd5e1' }}>{row.v}</span>
                  </div>
                ))}
              </div>

              {data.partes && Object.values(data.partes).some(Boolean) && (
                <div style={cardBase}>
                  {[
                    { k: 'Demandante', v: data.partes.demandante },
                    { k: 'Demandado', v: data.partes.demandado },
                    { k: 'Apoderado', v: data.partes.apoderado },
                    { k: 'Contraparte', v: data.partes.contraparte },
                  ].filter(row => row.v).map((row, i, arr) => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderBottom: i < arr.length - 1 ? rowBorder : 'none', alignItems: 'flex-start' }}>
                      <span style={kStyle}>{row.k}</span><span style={vStyle}>{row.v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: docs */}
          {!loading && data && tab === 'docs' && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.gold.length === 0
                ? <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.4)', fontStyle: 'italic' }}>Sin documentos asignados.</p>
                : data.gold.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: TIPO_CLR[g.documento.tipo] ?? '#94a3b8', flexShrink: 0 }}>{g.documento.tipo}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: '#e2e8f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.documento.nombre}</p>
                      {g.documento.resumen && <p style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.documento.resumen}</p>}
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.45)', flexShrink: 0 }}>{fmtFecha(g.asignadoEn)}</span>
                  </div>
                ))
              }
            </div>
          )}

          {/* Tab: ia */}
          {!loading && data && tab === 'ia' && (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={analizar} disabled={analizando || data.gold.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8', cursor: analizando || data.gold.length === 0 ? 'not-allowed' : 'pointer', opacity: analizando || data.gold.length === 0 ? 0.5 : 1 }}>
                  {analizando ? '⟳ Analizando…' : '✦ Generar análisis'}
                </button>
              </div>

              {data.resumenIA
                ? (
                  <div style={{ borderLeft: '2px solid rgba(129,140,248,0.4)', paddingLeft: 12 }}>
                    <p style={{ fontSize: 12, color: 'rgba(203,213,225,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{data.resumenIA}</p>
                    {data.ultimoAnalisis && <p style={{ fontSize: 10, color: 'rgba(100,116,139,0.4)', marginTop: 8 }}>Último análisis: {fmtFecha(data.ultimoAnalisis)}</p>}
                  </div>
                )
                : (
                  <p style={{ fontSize: 12, color: 'rgba(100,116,139,0.45)', fontStyle: 'italic' }}>
                    {data.gold.length === 0 ? 'Asigná documentos al expediente para generar el análisis.' : 'Sin análisis. Hacé clic en "Generar análisis".'}
                  </p>
                )
              }

              {Array.isArray(data.documentosFaltantes) && data.documentosFaltantes.length > 0 && (
                <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 0 }}>Documentos faltantes</p>
                  {(data.documentosFaltantes as string[]).map((d, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'rgba(248,113,113,0.8)', margin: '0 0 4px', display: 'flex', gap: 5 }}>⚠ {d}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
