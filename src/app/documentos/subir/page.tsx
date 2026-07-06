'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FolderOpen, X, CheckCircle2, AlertCircle, Loader2, FileText, File } from 'lucide-react'
import Link from 'next/link'

interface ArchivoItem {
  id: string
  file: File
  rutaCarpeta?: string
  estado: 'pendiente' | 'subiendo' | 'procesando' | 'listo' | 'error'
  documentoId?: string
  mensaje?: string
  tipo?: string
  area?: string
}

const MAX_MB = 15
const TIPOS_ACEPTADOS = /\.(pdf|doc|docx|txt|md)$/i

function iconoArchivo(nombre: string) {
  if (/\.pdf$/i.test(nombre)) return <File className="w-4 h-4 text-red-400" />
  if (/\.docx?$/i.test(nombre)) return <FileText className="w-4 h-4 text-blue-400" />
  return <FileText className="w-4 h-4 text-gray-400" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

export default function SubirDocumentosPage() {
  const [archivos, setArchivos] = useState<ArchivoItem[]>([])
  const [actor, setActor] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const carpetaRef = useRef<HTMLInputElement>(null)

  const agregarArchivos = useCallback((files: File[], carpetaBase?: string) => {
    const nuevos: ArchivoItem[] = []
    for (const file of files) {
      if (!TIPOS_ACEPTADOS.test(file.name)) continue
      if (file.size > MAX_MB * 1_048_576) {
        nuevos.push({
          id: crypto.randomUUID(),
          file,
          rutaCarpeta: carpetaBase,
          estado: 'error',
          mensaje: `Supera el límite de ${MAX_MB}MB`,
        })
        continue
      }
      nuevos.push({
        id: crypto.randomUUID(),
        file,
        rutaCarpeta: carpetaBase,
        estado: 'pendiente',
      })
    }
    setArchivos(prev => [...prev, ...nuevos])
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    const files: File[] = []
    for (const item of Array.from(e.dataTransfer.items)) {
      const f = item.getAsFile()
      if (f) files.push(f)
    }
    agregarArchivos(files)
  }, [agregarArchivos])

  const onSeleccionArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    agregarArchivos(Array.from(e.target.files))
    e.target.value = ''
  }

  const onSeleccionCarpeta = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const rutaBase = files[0]?.webkitRelativePath?.split('/')[0] ?? 'carpeta'
    agregarArchivos(files, rutaBase)
    e.target.value = ''
  }

  const quitar = (id: string) => setArchivos(prev => prev.filter(a => a.id !== id))
  const limpiarLista = () => setArchivos([])

  const poll = async (docId: string, itemId: string) => {
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 3_000))
      try {
        const res = await fetch(`/api/documentos/${docId}/estado`)
        if (!res.ok) break
        const data = await res.json() as { estado: string; tipo?: string; area?: string }
        if (data.estado === 'LISTO') {
          setArchivos(prev => prev.map(a =>
            a.id === itemId ? { ...a, estado: 'listo', tipo: data.tipo, area: data.area } : a
          ))
          return
        }
        if (data.estado === 'ERROR') {
          setArchivos(prev => prev.map(a =>
            a.id === itemId ? { ...a, estado: 'error', mensaje: 'Error en clasificación' } : a
          ))
          return
        }
      } catch { break }
    }
    setArchivos(prev => prev.map(a =>
      a.id === itemId && a.estado === 'procesando'
        ? { ...a, mensaje: 'Procesando en segundo plano…' }
        : a
    ))
  }

  const subirTodo = async () => {
    const pendientes = archivos.filter(a => a.estado === 'pendiente')
    if (pendientes.length === 0) return
    setSubiendo(true)

    for (const item of pendientes) {
      setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, estado: 'subiendo' } : a))

      const fd = new FormData()
      fd.append('archivo', item.file)
      if (actor) fd.append('actor', actor)
      if (proyectoId) fd.append('proyectoId', proyectoId)
      if (item.rutaCarpeta) fd.append('origenCarpeta', item.rutaCarpeta)

      try {
        const res = await fetch('/api/documentos', { method: 'POST', body: fd })
        const data = await res.json() as { documentoId?: string; error?: string }

        if (!res.ok || !data.documentoId) {
          setArchivos(prev => prev.map(a =>
            a.id === item.id ? { ...a, estado: 'error', mensaje: data.error ?? 'Error al subir' } : a
          ))
          continue
        }

        setArchivos(prev => prev.map(a =>
          a.id === item.id ? { ...a, estado: 'procesando', documentoId: data.documentoId } : a
        ))
        poll(data.documentoId!, item.id)
      } catch {
        setArchivos(prev => prev.map(a =>
          a.id === item.id ? { ...a, estado: 'error', mensaje: 'Error de red' } : a
        ))
      }
    }
    setSubiendo(false)
  }

  const pendientes = archivos.filter(a => a.estado === 'pendiente').length
  const listos = archivos.filter(a => a.estado === 'listo').length
  const errores = archivos.filter(a => a.estado === 'error').length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-semibold text-white">Subir documentos</h1>
          <p className="text-sm text-gray-400 mt-1">
            Sube archivos individuales o carpetas completas. El sistema los clasifica automáticamente.
          </p>
        </div>

        {/* Zona drag & drop */}
        <div
          onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors
            ${arrastrando ? 'border-cyan-400 bg-cyan-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'}`}
        >
          <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-300 font-medium">Arrastra archivos aquí o usa los botones</p>
          <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX, TXT, MD · Máx {MAX_MB}MB por archivo</p>

          <div className="flex gap-3 justify-center mt-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors"
            >
              Seleccionar archivos
            </button>
            <button
              type="button"
              onClick={() => carpetaRef.current?.click()}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" /> Carpeta completa
            </button>
          </div>
        </div>

        <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md" className="hidden" onChange={onSeleccionArchivos} />
        <input ref={carpetaRef} type="file" className="hidden" onChange={onSeleccionCarpeta}
          // @ts-expect-error atributo no estándar pero soportado por Chrome/Firefox
          webkitdirectory="" />

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tu nombre (opcional)</label>
            <input
              value={actor}
              onChange={e => setActor(e.target.value)}
              placeholder="Ej: María López"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">ID del proyecto (opcional)</label>
            <input
              value={proyectoId}
              onChange={e => setProyectoId(e.target.value)}
              placeholder="cuid del proyecto..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-cyan-600"
            />
          </div>
        </div>

        {/* Lista de archivos */}
        {archivos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                {archivos.length} archivo{archivos.length !== 1 ? 's' : ''}
                {listos > 0 && <span className="text-emerald-400 ml-2">· {listos} listos</span>}
                {errores > 0 && <span className="text-red-400 ml-2">· {errores} con error</span>}
              </p>
              <button onClick={limpiarLista} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Limpiar lista
              </button>
            </div>

            <div className="divide-y divide-gray-800 border border-gray-800 rounded-xl overflow-hidden">
              {archivos.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-gray-900/60">
                  {iconoArchivo(item.file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(item.file.size)}
                      {item.rutaCarpeta && <span className="ml-2 text-gray-600">· {item.rutaCarpeta}</span>}
                      {item.tipo && <span className="ml-2 text-cyan-500">· {item.tipo}{item.area ? ` / ${item.area}` : ''}</span>}
                    </p>
                    {item.mensaje && <p className="text-xs text-red-400 mt-0.5">{item.mensaje}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.estado === 'pendiente' && (
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Pendiente</span>
                    )}
                    {item.estado === 'subiendo' && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                    {item.estado === 'procesando' && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        <span className="text-xs text-amber-400">Clasificando…</span>
                      </div>
                    )}
                    {item.estado === 'listo' && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        {item.documentoId && (
                          <Link href={`/documentos/${item.documentoId}`} className="text-xs text-cyan-400 hover:underline">Ver</Link>
                        )}
                      </div>
                    )}
                    {item.estado === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {item.estado === 'pendiente' && (
                      <button onClick={() => quitar(item.id)} className="text-gray-600 hover:text-gray-400 ml-1">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {pendientes > 0 && (
              <button
                onClick={subirTodo}
                disabled={subiendo}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {subiendo
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</>
                  : <><Upload className="w-4 h-4" /> Subir {pendientes} archivo{pendientes !== 1 ? 's' : ''}</>
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
