'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import {
  FileText, Download, Archive, ArrowLeft, Clock,
  Tag, FolderOpen, User, AlertCircle, Loader2, GitBranch,
  Eye, X, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import VersionesTimeline, { type VersionItem } from '@/components/VersionesTimeline'

interface Documento {
  id: string
  nombre: string
  tipo: string
  area?: string
  estado: string
  origen: string
  origenCarpeta?: string
  mimeType?: string
  tamanoBytes?: number
  resumen?: string
  datosClave?: string
  textoExtraido?: string
  creadoPor?: string
  createdAt: string
  updatedAt: string
  versionNumero: number
  esVersionActual: boolean
  tieneArchivo: boolean
  proyectoId?: string
  proyecto?: { id: string; nombre: string }
  documentoPadre?: { id: string; versionNumero: number; nombre: string }
  versiones: {
    id: string; versionNumero: number; createdAt: string
    creadoPor?: string; tamanoBytes?: number; esVersionActual: boolean
  }[]
  eventos: {
    id: string; accion: string; actor?: string; detalle?: string; createdAt: string
  }[]
}

const ESTADO_COLOR: Record<string, string> = {
  LISTO:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  PROCESANDO: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  ERROR:      'text-red-400 bg-red-500/10 border-red-500/25',
  ARCHIVADO:  'text-zinc-400 bg-zinc-500/10 border-zinc-500/25',
}

const TIPO_STYLE: Record<string, string> = {
  CONTRATO:            'text-sky-300 bg-sky-500/10 border-sky-500/25',
  ACTA:                'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  FORMATO:             'text-violet-300 bg-violet-500/10 border-violet-500/25',
  DOCUMENTACION_LEGAL: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  OTRO:                'text-zinc-400 bg-zinc-500/10 border-zinc-500/25',
}

const GLASS = 'bg-white/[0.04] backdrop-blur-md border border-white/[0.08]'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(b?: number) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1_048_576).toFixed(1)} MB`
}

function isTxt(mime?: string, nombre?: string) {
  if (mime?.startsWith('text/')) return true
  if (!nombre) return false
  return /\.(txt|md|csv|json|xml|html?)$/i.test(nombre)
}

function isPdf(mime?: string, nombre?: string) {
  return mime === 'application/pdf' || /\.pdf$/i.test(nombre ?? '')
}

// ── Modal visor de archivo ─────────────────────────────────────────
function VisorModal({ id, nombre, mimeType, textoExtraido, onClose }: {
  id: string; nombre: string; mimeType?: string; textoExtraido?: string; onClose: () => void
}) {
  const url = `/api/documentos/${id}/archivo?inline=1`
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!mounted) return null

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
          background: 'rgba(8,8,20,0.92)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span className="text-sm font-medium text-white/80 truncate">{nombre}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 px-2.5 py-1.5 rounded-lg hover:bg-sky-500/10 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Nueva pestaña
            </a>
            <a
              href={`/api/documentos/${id}/archivo`}
              download
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.07] transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Descargar
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all"
              title="Cerrar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto min-h-0">
          {isPdf(mimeType, nombre) ? (
            <iframe
              src={url}
              className="w-full h-full"
              style={{ minHeight: '70vh', border: 'none', background: '#fff' }}
              title={nombre}
            />
          ) : isTxt(mimeType, nombre) ? (
            <pre className="p-6 text-xs text-white/70 leading-relaxed whitespace-pre-wrap font-mono">
              {textoExtraido ?? 'Sin contenido extraído'}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <FileText className="w-12 h-12 text-white/15" />
              <p className="text-sm text-white/40">Vista previa no disponible para este tipo de archivo</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Abrir en nueva pestaña
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

type Tab = 'detalle' | 'versiones' | 'auditoria'

export default function DocumentoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [doc, setDoc] = useState<Documento | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('detalle')
  const [archivando, setArchivando] = useState(false)
  const [visorAbierto, setVisorAbierto] = useState(false)
  const [actor] = useState('sistema')

  const [versiones, setVersiones] = useState<VersionItem[]>([])
  const [cargandoVersiones, setCargandoVersiones] = useState(false)

  useEffect(() => {
    fetch(`/api/documentos/${id}`, { headers: { 'x-actor': actor } })
      .then(r => r.ok ? r.json() : Promise.reject('No encontrado'))
      .then((d: Documento) => setDoc(d))
      .catch(() => setError('No se pudo cargar el documento'))
      .finally(() => setCargando(false))
  }, [id, actor])

  useEffect(() => {
    if (tab !== 'versiones' || versiones.length > 0) return
    setCargandoVersiones(true)
    fetch(`/api/documentos/${id}/versiones`)
      .then(r => r.json())
      .then((data: VersionItem[]) => setVersiones(data))
      .catch(console.error)
      .finally(() => setCargandoVersiones(false))
  }, [tab, id, versiones.length])

  const archivar = async () => {
    if (!doc || !confirm('¿Archivar este documento? Seguirá existiendo pero no aparecerá en búsquedas normales.')) return
    setArchivando(true)
    try {
      const res = await fetch(`/api/documentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ARCHIVADO', actor }),
      })
      if (res.ok) setDoc(prev => prev ? { ...prev, estado: 'ARCHIVADO' } : prev)
    } finally { setArchivando(false) }
  }

  if (cargando) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
    </div>
  )

  if (error || !doc) return (
    <div className="flex items-center justify-center min-h-[60vh] text-red-400 gap-2">
      <AlertCircle className="w-5 h-5" />{error || 'Documento no encontrado'}
    </div>
  )

  const datosClaveObj = (() => {
    try { return doc.datosClave ? JSON.parse(doc.datosClave) as Record<string, unknown> : null }
    catch { return null }
  })()

  const tieneHistorial = doc.versiones.length > 0 || !!doc.documentoPadre
  const tabs: Tab[] = tieneHistorial ? ['detalle', 'versiones', 'auditoria'] : ['detalle', 'auditoria']

  const TAB_LABELS: Record<Tab, string> = {
    detalle:   'Detalle',
    versiones: versiones.length > 0 ? `Versiones (${versiones.length})` : 'Versiones',
    auditoria: 'Auditoria',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.back()}
            className="mt-1 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white leading-snug">{doc.nombre}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-semibold ${ESTADO_COLOR[doc.estado] ?? ESTADO_COLOR.PROCESANDO}`}>
                {doc.estado}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${TIPO_STYLE[doc.tipo] ?? TIPO_STYLE.OTRO}`}>
                {doc.tipo}
              </span>
              {doc.area && <span className="text-xs text-sky-400/80">· {doc.area}</span>}
              {doc.versionNumero > 1 && (
                <span className="text-xs text-violet-400">v{doc.versionNumero}</span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {doc.tieneArchivo && (
            <>
              {/* Botón Abrir */}
              <button
                onClick={() => setVisorAbierto(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white
                  bg-sky-500/20 border border-sky-500/30 hover:bg-sky-500/30 hover:border-sky-400/50
                  transition-all duration-150 active:scale-95"
              >
                <Eye className="w-4 h-4" /> Abrir
              </button>
              {/* Botón Descargar */}
              <a
                href={`/api/documentos/${id}/archivo`}
                download
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white/80
                  bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.10] hover:text-white
                  transition-all duration-150 active:scale-95"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
            </>
          )}
          {doc.estado !== 'ARCHIVADO' && (
            <button
              onClick={archivar}
              disabled={archivando}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
                text-white/50 bg-white/[0.04] border border-white/[0.07]
                hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400
                transition-all duration-150 active:scale-95 disabled:opacity-40"
            >
              {archivando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
              Archivar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.07]">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
              ${tab === t
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-white/40 hover:text-white/70'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab: Detalle */}
      {tab === 'detalle' && (
        <div className="space-y-4">
          {doc.resumen && (
            <div className={`${GLASS} rounded-xl p-4`}>
              <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Resumen</h2>
              <p className="text-sm text-white/80 leading-relaxed">{doc.resumen}</p>
            </div>
          )}

          {datosClaveObj && Object.keys(datosClaveObj).length > 0 && (
            <div className={`${GLASS} rounded-xl p-4`}>
              <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-3">Datos clave</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                {Object.entries(datosClaveObj).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-white/30 capitalize">{k}</dt>
                    <dd className="text-sm text-white/80">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Metadata */}
          <div className={`${GLASS} rounded-xl p-4`}>
            <h2 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-3">Metadata</h2>
            <dl className="space-y-2">
              {[
                { icon: <Tag className="w-3.5 h-3.5" />, label: 'Tipo', val: `${doc.tipo}${doc.area ? ` · ${doc.area}` : ''}` },
                { icon: <FileText className="w-3.5 h-3.5" />, label: 'Tamaño', val: formatBytes(doc.tamanoBytes) },
                { icon: <User className="w-3.5 h-3.5" />, label: 'Subido por', val: doc.creadoPor ?? '—' },
                { icon: <Clock className="w-3.5 h-3.5" />, label: 'Creado', val: fmt(doc.createdAt) },
                { icon: <Clock className="w-3.5 h-3.5" />, label: 'Actualizado', val: fmt(doc.updatedAt) },
                ...(doc.origenCarpeta ? [{ icon: <FolderOpen className="w-3.5 h-3.5" />, label: 'Carpeta origen', val: doc.origenCarpeta }] : []),
                ...(doc.proyecto ? [{ icon: <GitBranch className="w-3.5 h-3.5" />, label: 'Proyecto', val: doc.proyecto.nombre }] : []),
              ].map(row => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="text-white/25 mt-0.5 flex-shrink-0">{row.icon}</span>
                  <span className="text-xs text-white/30 w-28 flex-shrink-0 mt-0.5">{row.label}</span>
                  <span className="text-sm text-white/70">{row.val}</span>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Tab: Versiones */}
      {tab === 'versiones' && (
        <div className={`${GLASS} rounded-xl p-5`}>
          {cargandoVersiones ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            </div>
          ) : (
            <VersionesTimeline
              versiones={versiones}
              documentoActualId={id}
              actor={actor}
            />
          )}
        </div>
      )}

      {/* Tab: Auditoría */}
      {tab === 'auditoria' && (
        <div className={`${GLASS} rounded-xl overflow-hidden`}>
          {doc.eventos.length === 0 ? (
            <p className="text-sm text-white/30 text-center py-8">Sin eventos registrados</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] text-white/30 uppercase tracking-widest">
                  <th className="text-left px-4 py-3">Acción</th>
                  <th className="text-left px-4 py-3">Actor</th>
                  <th className="text-left px-4 py-3">Detalle</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {doc.eventos.map(ev => (
                  <tr key={ev.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5 text-white/60 font-mono text-[11px] font-semibold">{ev.accion}</td>
                    <td className="px-4 py-2.5 text-white/50 text-xs">{ev.actor ?? '—'}</td>
                    <td className="px-4 py-2.5 text-white/35 text-xs max-w-xs truncate">{ev.detalle ?? '—'}</td>
                    <td className="px-4 py-2.5 text-white/30 text-xs whitespace-nowrap">{fmt(ev.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal visor */}
      {visorAbierto && doc.tieneArchivo && (
        <VisorModal
          id={id}
          nombre={doc.nombre}
          mimeType={doc.mimeType}
          textoExtraido={doc.textoExtraido}
          onClose={() => setVisorAbierto(false)}
        />
      )}
    </div>
  )
}
