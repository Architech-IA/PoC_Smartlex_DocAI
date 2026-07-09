'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Search, MessageSquare, FileText, File, Loader2,
  AlertCircle, ArrowRight, ChevronDown, ChevronUp, Sparkles,
  X, ExternalLink, Download, Eye,
} from 'lucide-react'
import Link from 'next/link'
import GestorLayout from '@/components/GestorLayout'

interface DocResultado {
  id: string
  nombre: string
  tipo: string
  area?: string
  resumen?: string
  similitud: number
  createdAt: string
}

interface Fuente {
  id: string
  nombre: string
  cita: string
}

interface MensajeChat {
  rol: 'usuario' | 'asistente'
  texto: string
  fuentes?: Fuente[]
  confianza?: string
  docsConsultados?: number
}

const TIPO_STYLE: Record<string, { label: string; cls: string }> = {
  CONTRATO:            { label: 'Contrato', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/25' },
  ACTA:                { label: 'Acta',     cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' },
  FORMATO:             { label: 'Formato',  cls: 'text-violet-300 bg-violet-500/10 border-violet-500/25' },
  DOCUMENTACION_LEGAL: { label: 'Legal',    cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  OTRO:                { label: 'Otro',     cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25' },
}

const CONFIANZA_STYLE: Record<string, string> = {
  ALTA:  'text-emerald-400',
  MEDIA: 'text-amber-400',
  BAJA:  'text-red-400',
}

function IconoArchivo({ nombre }: { nombre: string }) {
  if (/\.pdf$/i.test(nombre)) return <File className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
  return <FileText className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
}

function pct(s: number) { return Math.round(s * 100) }

function BarraSimilitud({ valor }: { valor: number }) {
  const p = pct(valor)
  const color = p >= 75 ? '#10b981' : p >= 55 ? '#f59e0b' : '#818cf8'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums" style={{ color }}>{p}% similitud</span>
    </div>
  )
}

// ── Modal visor ───────────────────────────────────────────────────────────────
interface DocPreview { id: string; nombre: string; tipo: string; area?: string; resumen?: string }

interface DocFull {
  id: string; nombre: string; tipo: string; area?: string; estado: string
  resumen?: string; datosClave?: string; textoExtraido?: string; mimeType?: string
  tamanoBytes?: number; creadoPor?: string; createdAt: string; updatedAt: string
  tieneArchivo: boolean
  eventos: { id: string; accion: string; actor?: string; detalle?: string; createdAt: string }[]
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtBytes(b?: number) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1_048_576).toFixed(1)} MB`
}

type ModalTab = 'archivo' | 'detalle' | 'auditoria'

function VisorModal({ doc: docInit, onClose }: { doc: DocPreview; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [tab, setTab] = useState<ModalTab>('archivo')
  const [docFull, setDocFull] = useState<DocFull | null>(null)
  const [cargando, setCargando] = useState(true)

  const url = `/api/documentos/${docInit.id}/archivo?inline=1`
  const isPdf = /\.pdf$/i.test(docInit.nombre)
  const isTxt = /\.(txt|md|csv|json|xml)$/i.test(docInit.nombre)

  useEffect(() => {
    setMounted(true)
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    // Cargar datos completos del documento
    fetch(`/api/documentos/${docInit.id}`)
      .then(r => r.json())
      .then((d: DocFull) => setDocFull(d))
      .catch(console.error)
      .finally(() => setCargando(false))
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose, docInit.id])

  if (!mounted) return null

  const doc = docFull ?? docInit
  const datosClaveObj = (() => {
    try { return docFull?.datosClave ? JSON.parse(docFull.datosClave) as Record<string, unknown> : null }
    catch { return null }
  })()

  const TABS: { key: ModalTab; label: string }[] = [
    { key: 'archivo',   label: 'Archivo' },
    { key: 'detalle',   label: 'Detalle' },
    { key: 'auditoria', label: 'Auditoría' },
  ]

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(14px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden"
        style={{
          maxHeight: '90vh',
          background: 'rgba(8,8,20,0.96)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-white/90 truncate">{docInit.nombre}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold flex-shrink-0 ${TIPO_STYLE[docInit.tipo]?.cls ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25'}`}>
              {TIPO_STYLE[docInit.tipo]?.label ?? docInit.tipo}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-4">
            {(docFull?.tieneArchivo ?? true) && (
              <>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 transition-all">
                  <ExternalLink className="w-3.5 h-3.5" /> Nueva pestaña
                </a>
                <a href={`/api/documentos/${docInit.id}/archivo`} download
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.07] transition-all">
                  <Download className="w-3.5 h-3.5" /> Descargar
                </a>
              </>
            )}
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all ml-1" title="Cerrar (Esc)">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 px-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px
                ${tab === t.key ? 'border-sky-400 text-sky-400' : 'border-transparent text-white/35 hover:text-white/60'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-auto min-h-0">

          {/* Tab: Archivo */}
          {tab === 'archivo' && (
            cargando ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
              </div>
            ) : isPdf ? (
              <iframe src={url} className="w-full" style={{ minHeight: '65vh', border: 'none', background: '#fff' }} title={docInit.nombre} />
            ) : isTxt ? (
              <pre className="p-6 text-xs text-white/70 leading-relaxed whitespace-pre-wrap font-mono">
                {docFull?.textoExtraido ?? '(sin contenido extraído)'}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <FileText className="w-12 h-12 text-white/15" />
                <p className="text-sm text-white/40">Vista previa no disponible para este tipo de archivo</p>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 transition-colors">
                  <ExternalLink className="w-4 h-4" /> Abrir en nueva pestaña
                </a>
              </div>
            )
          )}

          {/* Tab: Detalle */}
          {tab === 'detalle' && (
            <div className="p-5 space-y-4">
              {cargando ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>
              ) : (
                <>
                  {docFull?.resumen && (
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-2">Resumen</p>
                      <p className="text-sm text-white/75 leading-relaxed">{docFull.resumen}</p>
                    </div>
                  )}
                  {datosClaveObj && Object.keys(datosClaveObj).length > 0 && (
                    <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-3">Datos clave</p>
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(datosClaveObj).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs text-white/30 capitalize">{k}</dt>
                            <dd className="text-sm text-white/75">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-widest mb-3">Metadata</p>
                    <dl className="space-y-2">
                      {[
                        { label: 'Estado',      val: docFull?.estado ?? '—' },
                        { label: 'Tipo',        val: `${docFull?.tipo ?? '—'}${docFull?.area ? ` · ${docFull.area}` : ''}` },
                        { label: 'Tamaño',      val: fmtBytes(docFull?.tamanoBytes) },
                        { label: 'Subido por',  val: docFull?.creadoPor ?? '—' },
                        { label: 'Creado',      val: docFull ? fmtDate(docFull.createdAt) : '—' },
                        { label: 'Actualizado', val: docFull ? fmtDate(docFull.updatedAt) : '—' },
                      ].map(row => (
                        <div key={row.label} className="flex items-start gap-3">
                          <span className="text-xs text-white/30 w-24 flex-shrink-0 mt-0.5">{row.label}</span>
                          <span className="text-sm text-white/70">{row.val}</span>
                        </div>
                      ))}
                    </dl>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab: Auditoría */}
          {tab === 'auditoria' && (
            cargando ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-400 animate-spin" /></div>
            ) : !docFull?.eventos?.length ? (
              <p className="text-sm text-white/30 text-center py-12">Sin eventos registrados</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-white/30 uppercase tracking-widest" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th className="text-left px-5 py-3">Acción</th>
                    <th className="text-left px-4 py-3">Actor</th>
                    <th className="text-left px-4 py-3">Detalle</th>
                    <th className="text-left px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {docFull.eventos.map(ev => (
                    <tr key={ev.id} className="hover:bg-white/[0.025] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-2.5 text-white/60 font-mono text-[11px] font-semibold">{ev.accion}</td>
                      <td className="px-4 py-2.5 text-white/45 text-xs">{ev.actor ?? '—'}</td>
                      <td className="px-4 py-2.5 text-white/30 text-xs max-w-xs truncate">{ev.detalle ?? '—'}</td>
                      <td className="px-4 py-2.5 text-white/25 text-xs whitespace-nowrap">{fmtDate(ev.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

const GLASS = 'bg-white/[0.04] backdrop-blur-md border border-white/[0.08]'
const INPUT_BASE = 'w-full rounded-xl px-4 py-3.5 text-sm text-white bg-white/[0.06] border border-white/[0.1] placeholder:text-white/25 focus:outline-none focus:border-sky-400/60 focus:bg-white/[0.08] transition-all duration-200'
const BTN_PRIMARY = 'px-5 py-3.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 min-h-[44px] flex-shrink-0 transition-all duration-200 bg-sky-500 hover:bg-sky-400 active:scale-95 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed disabled:active:scale-100'

export default function BuscarPage() {
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<DocResultado[] | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [docPreview, setDocPreview] = useState<DocPreview | null>(null)
  const abrirVisor = useCallback((doc: DocResultado) => {
    setDocPreview({ id: doc.id, nombre: doc.nombre, tipo: doc.tipo, area: doc.area, resumen: doc.resumen })
  }, [])

  const [pregunta, setPregunta] = useState('')
  const [chateando, setChateando] = useState(false)
  const [historial, setHistorial] = useState<MensajeChat[]>([])
  const [errorChat, setErrorChat] = useState('')
  const [fuentesAbiertas, setFuentesAbiertas] = useState<Set<number>>(new Set())

  const chatEndRef = useRef<HTMLDivElement>(null)

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setBuscando(true)
    setErrorBusqueda('')
    setResultados(null)
    try {
      const res = await fetch('/api/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit: 10 }),
      })
      const data = await res.json() as { resultados?: DocResultado[]; error?: string }
      if (!res.ok) { setErrorBusqueda(data.error ?? 'Error en búsqueda'); return }
      setResultados(data.resultados ?? [])
    } catch { setErrorBusqueda('Error de red') }
    finally { setBuscando(false) }
  }

  const preguntar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!pregunta.trim() || chateando) return
    const txt = pregunta.trim()
    setPregunta('')
    setErrorChat('')
    setHistorial(prev => [...prev, { rol: 'usuario', texto: txt }])
    setChateando(true)
    try {
      const res = await fetch('/api/buscar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: txt }),
      })
      const data = await res.json() as {
        respuesta?: string; fuentes?: Fuente[]; confianza?: string
        documentosConsultados?: number; error?: string
      }
      if (!res.ok || !data.respuesta) {
        setHistorial(prev => [...prev, { rol: 'asistente', texto: data.error ?? 'Sin respuesta' }])
        return
      }
      setHistorial(prev => [...prev, {
        rol: 'asistente', texto: data.respuesta!,
        fuentes: data.fuentes, confianza: data.confianza,
        docsConsultados: data.documentosConsultados,
      }])
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch { setErrorChat('Error de red') }
    finally { setChateando(false) }
  }

  const toggleFuentes = (idx: number) =>
    setFuentesAbiertas(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s })

  return (
    <GestorLayout activeHref="/buscar">
      <div className="max-w-3xl mx-auto space-y-8 pb-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/30">
          <Link href="/" className="hover:text-white/60 transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/gestor" className="hover:text-white/60 transition-colors">Gestor</Link>
          <span>/</span>
          <span className="text-white/70">Búsqueda</span>
        </nav>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white tracking-tight">Búsqueda semántica</h1>
          <p className="text-sm text-white/40">
            Buscá por significado, no por palabras exactas. Luego preguntá directamente sobre los documentos.
          </p>
        </div>

        {/* Buscador */}
        <form onSubmit={buscar} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Ej: "contratos con cláusula de exclusividad vencidos en 2024"'
              className={`${INPUT_BASE} pl-11`}
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={buscando || !query.trim()} className={BTN_PRIMARY}>
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </form>

        {/* Error búsqueda */}
        {errorBusqueda && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorBusqueda}
          </div>
        )}

        {/* Resultados */}
        {resultados !== null && (
          <div className="space-y-3">
            <p className="text-xs text-white/30 px-1">
              {resultados.length === 0
                ? 'Sin resultados para esta búsqueda'
                : `${resultados.length} documento${resultados.length !== 1 ? 's' : ''} relevante${resultados.length !== 1 ? 's' : ''}`}
            </p>

            {resultados.map((doc, i) => {
              const ts = TIPO_STYLE[doc.tipo] ?? TIPO_STYLE.OTRO
              return (
                <div
                  key={doc.id}
                  className={`group ${GLASS} rounded-2xl p-4 transition-all duration-200 hover:bg-white/[0.07] hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-px cursor-default`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.07] flex-shrink-0">
                        <IconoArchivo nombre={doc.nombre} />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-sm font-semibold text-white truncate leading-tight">{doc.nombre}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold border ${ts.cls}`}>
                            {ts.label}
                          </span>
                          {doc.area && <span className="text-[11px] text-sky-400/80">{doc.area}</span>}
                        </div>
                        <BarraSimilitud valor={doc.similitud} />
                      </div>
                    </div>

                    <button
                      onClick={() => abrirVisor(doc)}
                      className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 flex-shrink-0 mt-1 transition-all font-medium opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </button>
                  </div>

                  {doc.resumen && (
                    <p className="text-xs text-white/40 mt-3 line-clamp-2 leading-relaxed pl-[52px]">
                      {doc.resumen}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Divisor decorativo */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <div className="flex items-center gap-1.5 text-xs text-white/25">
            <Sparkles className="w-3.5 h-3.5" />
            Chat con los documentos
          </div>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Chat */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Preguntá sobre los documentos</h2>
          </div>

          {historial.length > 0 && (
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 scroll-smooth">
              {historial.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                  {msg.rol === 'usuario' ? (
                    <div className="max-w-[80%] bg-sky-500/15 border border-sky-500/25 rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-sm text-white">{msg.texto}</p>
                    </div>
                  ) : (
                    <div className="max-w-[90%]">
                      <div className={`${GLASS} rounded-2xl rounded-tl-sm px-4 py-3`}>
                        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{msg.texto}</p>

                        {(msg.fuentes?.length ?? 0) > 0 && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleFuentes(idx)}
                              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                            >
                              {fuentesAbiertas.has(idx) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {msg.fuentes!.length} fuente{msg.fuentes!.length !== 1 ? 's' : ''}
                              {msg.confianza && (
                                <span className={`ml-1 ${CONFIANZA_STYLE[msg.confianza] ?? ''}`}>
                                  · confianza {msg.confianza.toLowerCase()}
                                </span>
                              )}
                            </button>

                            {fuentesAbiertas.has(idx) && (
                              <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2">
                                {msg.fuentes!.map((f, fi) => (
                                  <div key={fi} className="flex items-start gap-2">
                                    <FileText className="w-3 h-3 text-white/25 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <Link href={`/documentos/${f.id}`} className="text-xs text-sky-400 hover:text-sky-300 hover:underline truncate block transition-colors">
                                        {f.nombre}
                                      </Link>
                                      {f.cita && <p className="text-xs text-white/30 italic mt-0.5">&ldquo;{f.cita}&rdquo;</p>}
                                    </div>
                                  </div>
                                ))}
                                {msg.docsConsultados !== undefined && (
                                  <p className="text-xs text-white/25 mt-1">{msg.docsConsultados} documentos consultados</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {chateando && (
                <div className="flex justify-start">
                  <div className={`${GLASS} rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2`}>
                    <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                    <span className="text-sm text-white/40">Analizando documentos…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {errorChat && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorChat}
            </div>
          )}

          <form onSubmit={preguntar} className="flex gap-2">
            <input
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), preguntar())}
              placeholder='Ej: "¿Cuándo vence el contrato con Morales Vargas?"'
              disabled={chateando}
              className={`${INPUT_BASE} flex-1 disabled:opacity-40`}
            />
            <button type="submit" disabled={chateando || !pregunta.trim()} className={BTN_PRIMARY}>
              {chateando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              Preguntar
            </button>
          </form>
        </div>
      </div>

      {/* Modal visor */}
      {docPreview && (
        <VisorModal doc={docPreview} onClose={() => setDocPreview(null)} />
      )}
    </GestorLayout>
  )
}
