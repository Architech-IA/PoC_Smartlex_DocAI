'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  FileText, Download, Archive, ArrowLeft, Clock,
  Tag, FolderOpen, User, AlertCircle, Loader2, GitBranch,
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
  LISTO: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
  PROCESANDO: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
  ERROR: 'text-red-400 bg-red-950/40 border-red-800/50',
  ARCHIVADO: 'text-gray-400 bg-gray-800/40 border-gray-700/50',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatBytes(b?: number) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1_048_576).toFixed(1)} MB`
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
  const [actor] = useState('sistema')

  // Versiones: se cargan desde el endpoint de cadena completa
  const [versiones, setVersiones] = useState<VersionItem[]>([])
  const [cargandoVersiones, setCargandoVersiones] = useState(false)

  useEffect(() => {
    fetch(`/api/documentos/${id}`, { headers: { 'x-actor': actor } })
      .then(r => r.ok ? r.json() : Promise.reject('No encontrado'))
      .then((d: Documento) => setDoc(d))
      .catch(() => setError('No se pudo cargar el documento'))
      .finally(() => setCargando(false))
  }, [id, actor])

  // Cargar cadena de versiones al entrar en esa pestaña
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
      if (res.ok) {
        setDoc(prev => prev ? { ...prev, estado: 'ARCHIVADO' } : prev)
      }
    } finally {
      setArchivando(false)
    }
  }

  if (cargando) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  )

  if (error || !doc) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">
      <AlertCircle className="w-5 h-5 mr-2" />{error || 'Documento no encontrado'}
    </div>
  )

  const datosClaveObj = (() => {
    try { return doc.datosClave ? JSON.parse(doc.datosClave) as Record<string, unknown> : null }
    catch { return null }
  })()

  // La pestaña Versiones solo se muestra si hay historial
  const tieneHistorial = doc.versiones.length > 0 || !!doc.documentoPadre
  const tabs: Tab[] = tieneHistorial ? ['detalle', 'versiones', 'auditoria'] : ['detalle', 'auditoria']

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={() => router.back()} className="mt-1 text-gray-500 hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white leading-snug">{doc.nombre}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTADO_COLOR[doc.estado] ?? ESTADO_COLOR.PROCESANDO}`}>
                  {doc.estado}
                </span>
                <span className="text-xs text-gray-500">{doc.tipo}</span>
                {doc.area && <span className="text-xs text-cyan-600">· {doc.area}</span>}
                {doc.versionNumero > 1 && (
                  <span className="text-xs text-purple-400">v{doc.versionNumero}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {doc.tieneArchivo && (
              <a
                href={`/api/documentos/${id}/archivo`}
                download
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" /> Descargar
              </a>
            )}
            {doc.estado !== 'ARCHIVADO' && (
              <button
                onClick={archivar}
                disabled={archivando}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-red-900/50 rounded-lg text-sm text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {archivando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                Archivar
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px
                ${tab === t ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              {t === 'versiones'
                ? `Versiones${versiones.length > 0 ? ` (${versiones.length})` : ''}`
                : t}
            </button>
          ))}
        </div>

        {/* Tab: Detalle */}
        {tab === 'detalle' && (
          <div className="space-y-5">
            {doc.resumen && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Resumen</h2>
                <p className="text-sm text-gray-200 leading-relaxed">{doc.resumen}</p>
              </div>
            )}

            {datosClaveObj && Object.keys(datosClaveObj).length > 0 && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Datos clave</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {Object.entries(datosClaveObj).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-gray-500 capitalize">{k}</dt>
                      <dd className="text-sm text-gray-200">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Metadata</h2>
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
                    <span className="text-gray-600 mt-0.5 flex-shrink-0">{row.icon}</span>
                    <span className="text-xs text-gray-500 w-24 flex-shrink-0">{row.label}</span>
                    <span className="text-sm text-gray-300">{row.val}</span>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {/* Tab: Versiones */}
        {tab === 'versiones' && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
            {cargandoVersiones ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
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
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
            {doc.eventos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Sin eventos registrados</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500">
                    <th className="text-left px-4 py-2">Acción</th>
                    <th className="text-left px-4 py-2">Actor</th>
                    <th className="text-left px-4 py-2">Detalle</th>
                    <th className="text-left px-4 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {doc.eventos.map(ev => (
                    <tr key={ev.id} className="hover:bg-gray-800/40">
                      <td className="px-4 py-2 text-gray-300 font-mono text-xs">{ev.accion}</td>
                      <td className="px-4 py-2 text-gray-400">{ev.actor ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{ev.detalle ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmt(ev.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
