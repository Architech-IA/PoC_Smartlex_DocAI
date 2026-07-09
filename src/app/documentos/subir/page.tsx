'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FolderOpen, X, CheckCircle2, AlertCircle, Loader2, FileText, File } from 'lucide-react'
import Link from 'next/link'
import GestorLayout from '@/components/GestorLayout'

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
  return <FileText className="w-4 h-4 text-[#555]" />
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
        nuevos.push({ id: crypto.randomUUID(), file, rutaCarpeta: carpetaBase, estado: 'error', mensaje: `Supera el límite de ${MAX_MB}MB` })
        continue
      }
      nuevos.push({ id: crypto.randomUUID(), file, rutaCarpeta: carpetaBase, estado: 'pendiente' })
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
          setArchivos(prev => prev.map(a => a.id === itemId ? { ...a, estado: 'listo', tipo: data.tipo, area: data.area } : a))
          return
        }
        if (data.estado === 'ERROR') {
          setArchivos(prev => prev.map(a => a.id === itemId ? { ...a, estado: 'error', mensaje: 'Error en clasificación' } : a))
          return
        }
      } catch { break }
    }
    setArchivos(prev => prev.map(a => a.id === itemId && a.estado === 'procesando' ? { ...a, mensaje: 'Procesando en segundo plano…' } : a))
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
          setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, estado: 'error', mensaje: data.error ?? 'Error al subir' } : a))
          continue
        }
        setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, estado: 'procesando', documentoId: data.documentoId } : a))
        poll(data.documentoId!, item.id)
      } catch {
        setArchivos(prev => prev.map(a => a.id === item.id ? { ...a, estado: 'error', mensaje: 'Error de red' } : a))
      }
    }
    setSubiendo(false)
  }

  const pendientes = archivos.filter(a => a.estado === 'pendiente').length
  const listos = archivos.filter(a => a.estado === 'listo').length
  const errores = archivos.filter(a => a.estado === 'error').length

  return (
    <GestorLayout activeHref="/documentos/subir">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#555]">
          <Link href="/" className="hover:text-[#aaa] transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/gestor" className="hover:text-[#aaa] transition-colors">Gestor</Link>
          <span>/</span>
          <span className="text-white">Subir Documentos</span>
        </nav>

        <div>
          <h1 className="text-xl font-semibold text-white">Subir documentos</h1>
          <p className="text-sm text-[#555] mt-1">
            Sube archivos individuales o carpetas completas. El sistema los clasifica automáticamente.
          </p>
        </div>

        {/* Zona drag & drop */}
        <div
          onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            arrastrando
              ? 'border-[#06b6d4] bg-[#06b6d4]/5'
              : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#0a0a0a]'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#06b6d4]/10 border border-[#06b6d4]/20 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7 text-[#06b6d4]" />
          </div>
          <p className="text-white font-medium mb-1">Arrastrá archivos aquí o hacé clic para seleccionar</p>
          <p className="text-xs text-[#555]">PDF, DOC, DOCX, TXT, MD · Máx {MAX_MB}MB por archivo</p>
          <div className="flex gap-3 justify-center mt-5" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg text-sm text-[#aaa] hover:text-white transition-all min-h-[44px]"
            >
              Seleccionar archivos
            </button>
            <button
              type="button"
              onClick={() => carpetaRef.current?.click()}
              className="px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg text-sm text-[#aaa] hover:text-white transition-all flex items-center gap-2 min-h-[44px]"
            >
              <FolderOpen className="w-4 h-4" /> Carpeta completa
            </button>
          </div>
        </div>

        <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md" className="hidden" onChange={onSeleccionArchivos} />
        <input ref={carpetaRef} type="file" className="hidden" onChange={onSeleccionCarpeta}
          // @ts-expect-error atributo no estándar
          webkitdirectory="" />

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#555] mb-1.5">Tu nombre (opcional)</label>
            <input
              value={actor}
              onChange={e => setActor(e.target.value)}
              placeholder="Ej: María López"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#06b6d4] placeholder:text-[#555] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-[#555] mb-1.5">ID del proyecto (opcional)</label>
            <input
              value={proyectoId}
              onChange={e => setProyectoId(e.target.value)}
              placeholder="cuid del proyecto..."
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#06b6d4] placeholder:text-[#555] transition-colors"
            />
          </div>
        </div>

        {/* Lista de archivos */}
        {archivos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#555]">
                {archivos.length} archivo{archivos.length !== 1 ? 's' : ''}
                {listos > 0 && <span className="text-[#10b981] ml-2">· {listos} listos</span>}
                {errores > 0 && <span className="text-[#ef4444] ml-2">· {errores} con error</span>}
              </p>
              <button onClick={limpiarLista} className="text-xs text-[#555] hover:text-[#aaa] transition-colors">
                Limpiar lista
              </button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              {archivos.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                  {iconoArchivo(item.file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.file.name}</p>
                    <p className="text-xs text-[#555]">
                      {formatBytes(item.file.size)}
                      {item.rutaCarpeta && <span className="ml-2">· {item.rutaCarpeta}</span>}
                      {item.tipo && <span className="ml-2 text-[#06b6d4]">· {item.tipo}{item.area ? ` / ${item.area}` : ''}</span>}
                    </p>
                    {item.mensaje && <p className="text-xs text-[#ef4444] mt-0.5">{item.mensaje}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.estado === 'pendiente' && (
                      <span className="text-xs text-[#555] bg-[#111] border border-[#2a2a2a] px-2 py-0.5 rounded-full">Pendiente</span>
                    )}
                    {item.estado === 'subiendo' && <Loader2 className="w-4 h-4 text-[#06b6d4] animate-spin" />}
                    {item.estado === 'procesando' && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-4 h-4 text-[#f59e0b] animate-spin" />
                        <span className="text-xs text-[#f59e0b]">Clasificando…</span>
                      </div>
                    )}
                    {item.estado === 'listo' && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                        {item.documentoId && (
                          <Link href={`/documentos/${item.documentoId}`} className="text-xs text-[#06b6d4] hover:underline">Ver</Link>
                        )}
                      </div>
                    )}
                    {item.estado === 'error' && <AlertCircle className="w-4 h-4 text-[#ef4444]" />}
                    {item.estado === 'pendiente' && (
                      <button onClick={() => quitar(item.id)} className="text-[#555] hover:text-[#aaa] ml-1 transition-colors">
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
                className="w-full py-3 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2 min-h-[44px]"
                style={{
                  background: subiendo ? '#1e1e1e' : '#06b6d4',
                  cursor: subiendo ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!subiendo) (e.currentTarget as HTMLButtonElement).style.background = '#0891b2' }}
                onMouseLeave={(e) => { if (!subiendo) (e.currentTarget as HTMLButtonElement).style.background = '#06b6d4' }}
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
    </GestorLayout>
  )
}
