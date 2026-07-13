'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FolderOpen, X, CheckCircle2, AlertCircle, Loader2, FileText, File, ChevronDown, Plus } from 'lucide-react'
import Link from 'next/link'
import GestorLayout from '@/components/GestorLayout'

// ── Types ────────────────────────────────────────────────────────────────────

type ModoCarga = 'manual' | 'directa'

type EstadoArchivo =
  | 'pendiente'
  | 'subiendo'       // subiendo a BRONZE
  | 'bronze'         // en BRONZE
  | 'procesando'     // clasificando en SILVER
  | 'silver'         // indexado en SILVER
  | 'gold'           // asignado a cliente/expediente
  | 'error'

interface ArchivoItem {
  id: string
  file: File
  rutaCarpeta?: string
  estado: EstadoArchivo
  mensaje?: string
  documentoId?: string
}

interface Cliente { id: string; nombre: string; nit?: string | null }
interface Expediente { id: string; nombre: string; codigo?: string | null; estado: string }

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_MB = 15
const TIPOS_ACEPTADOS = /\.(pdf|doc|docx|txt|md)$/i
const POLL_MS = 2500

const ESTADO_CFG: Record<EstadoArchivo, { label: string; color: string }> = {
  pendiente:  { label: 'Pendiente',   color: '#555' },
  subiendo:   { label: 'Subiendo…',   color: '#06b6d4' },
  bronze:     { label: 'En BRONZE',   color: '#f59e0b' },
  procesando: { label: 'Procesando…', color: '#818cf8' },
  silver:     { label: 'En SILVER',   color: '#34d399' },
  gold:       { label: 'En GOLD',     color: '#fbbf24' },
  error:      { label: 'Error',       color: '#ef4444' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

async function pollHastaListo(documentoId: string, onEstado: (e: string) => void): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, POLL_MS))
    try {
      const res = await fetch(`/api/documentos/${documentoId}/estado`)
      if (!res.ok) continue
      const { estado } = await res.json() as { estado: string }
      onEstado(estado)
      if (estado === 'LISTO') return true
      if (estado === 'ERROR') return false
    } catch { /* reintento */ }
  }
  return false
}

// ── Modal selección de modo ──────────────────────────────────────────────────

function ModalModo({ onElegir, onCerrar }: { onElegir: (m: ModoCarga) => void; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <h2 className="text-base font-semibold text-white">¿Cómo querés procesar los archivos?</h2>
          <p className="text-xs text-[#555] mt-1">Elegí el tipo de carga antes de subir.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Manual */}
          <button onClick={() => onElegir('manual')}
            className="flex flex-col gap-2 rounded-xl p-4 text-left transition-all hover:border-[#3a3a3a]"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-lg">📥</span>
            <span className="text-sm font-medium text-white">Carga manual</span>
            <span className="text-xs text-[#555]">El archivo va a <span className="text-amber-400">BRONZE</span>. Lo procesás después desde el Explorador.</span>
          </button>

          {/* Directa */}
          <button onClick={() => onElegir('directa')}
            className="flex flex-col gap-2 rounded-xl p-4 text-left transition-all"
            style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.25)' }}>
            <span className="text-lg">⚡</span>
            <span className="text-sm font-medium text-white">Carga directa</span>
            <span className="text-xs text-[#555]">Pasa automáticamente por <span className="text-amber-400">BRONZE</span> → <span className="text-emerald-400">SILVER</span> → <span className="text-yellow-300">GOLD</span>.</span>
          </button>
        </div>

        <button onClick={onCerrar} className="w-full text-xs text-[#555] hover:text-[#aaa] transition-colors pt-1">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Modal selector cliente/expediente ────────────────────────────────────────

function ModalGold({
  onConfirmar,
  onCerrar,
}: {
  onConfirmar: (clienteId: string, expedienteId: string | null) => void
  onCerrar: () => void
}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [expedientes, setExpedientes] = useState<Expediente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [expedienteId, setExpedienteId] = useState('')
  const [cargando, setCargando] = useState(true)

  // Nuevo cliente inline
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [ncNombre, setNcNombre] = useState('')
  const [ncNit, setNcNit] = useState('')
  const [savingCliente, setSavingCliente] = useState(false)

  // Nuevo expediente inline
  const [nuevoExp, setNuevoExp] = useState(false)
  const [neNombre, setNeNombre] = useState('')
  const [neCodigo, setNeCodigo] = useState('')
  const [savingExp, setSavingExp] = useState(false)

  useEffect(() => {
    fetch('/api/clientes').then(r => r.json()).then((d: Cliente[]) => {
      setClientes(d)
      setCargando(false)
    }).catch(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!clienteId) { setExpedientes([]); setExpedienteId(''); return }
    fetch(`/api/expedientes?clienteId=${clienteId}`)
      .then(r => r.json()).then((d: Expediente[]) => setExpedientes(d)).catch(() => {})
    setExpedienteId('')
  }, [clienteId])

  const crearCliente = async () => {
    if (!ncNombre.trim()) return
    setSavingCliente(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: ncNombre.trim(), nit: ncNit.trim() || undefined }),
      })
      const c = await res.json() as Cliente
      setClientes(prev => [...prev, c])
      setClienteId(c.id)
      setNuevoCliente(false)
      setNcNombre(''); setNcNit('')
    } finally { setSavingCliente(false) }
  }

  const crearExpediente = async () => {
    if (!neNombre.trim() || !clienteId) return
    setSavingExp(true)
    try {
      const res = await fetch('/api/expedientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteId, nombre: neNombre.trim(), codigo: neCodigo.trim() || undefined }),
      })
      const e = await res.json() as Expediente
      setExpedientes(prev => [...prev, e])
      setExpedienteId(e.id)
      setNuevoExp(false)
      setNeNombre(''); setNeCodigo('')
    } finally { setSavingExp(false) }
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0', outline: 'none',
  }
  const labelStyle = { fontSize: 10, color: 'rgba(100,116,139,0.6)', fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'block', marginBottom: 4 }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <h2 className="text-base font-semibold text-white">Asignar a GOLD</h2>
          <p className="text-xs text-[#555] mt-1">Seleccioná cliente y expediente. Los archivos pasarán por todo el pipeline automáticamente.</p>
        </div>

        {cargando ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#818cf8]" /></div>
        ) : (
          <div className="space-y-4">
            {/* Cliente */}
            <div>
              <label style={labelStyle}>Cliente</label>
              {!nuevoCliente ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
                      <option value="">Seleccioná un cliente…</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.nit ? ` (${c.nit})` : ''}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555] pointer-events-none" />
                  </div>
                  <button onClick={() => setNuevoCliente(true)}
                    className="px-3 rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}>
                    <Plus className="w-3 h-3" /> Nuevo
                  </button>
                </div>
              ) : (
                <div className="space-y-2 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <input placeholder="Nombre del cliente *" value={ncNombre} onChange={e => setNcNombre(e.target.value)} style={inputStyle} />
                  <input placeholder="NIT (opcional)" value={ncNit} onChange={e => setNcNit(e.target.value)} style={inputStyle} />
                  <div className="flex gap-2">
                    <button onClick={crearCliente} disabled={savingCliente || !ncNombre.trim()}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8', opacity: ncNombre.trim() ? 1 : 0.5 }}>
                      {savingCliente ? 'Guardando…' : 'Crear cliente'}
                    </button>
                    <button onClick={() => setNuevoCliente(false)} className="px-3 text-xs text-[#555] hover:text-[#aaa]">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Expediente */}
            {clienteId && (
              <div>
                <label style={labelStyle}>Expediente / Caso <span style={{ color: 'rgba(100,116,139,0.4)', fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
                {!nuevoExp ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select value={expedienteId} onChange={e => setExpedienteId(e.target.value)}
                        style={{ ...inputStyle, appearance: 'none', paddingRight: 28, cursor: 'pointer' }}>
                        <option value="">Sin expediente</option>
                        {expedientes.map(e => <option key={e.id} value={e.id}>{e.codigo ? `[${e.codigo}] ` : ''}{e.nombre}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555] pointer-events-none" />
                    </div>
                    <button onClick={() => setNuevoExp(true)}
                      className="px-3 rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#aaa' }}>
                      <Plus className="w-3 h-3" /> Nuevo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <input placeholder="Nombre del expediente *" value={neNombre} onChange={e => setNeNombre(e.target.value)} style={inputStyle} />
                    <input placeholder="Código (ej: EXP-2026-001)" value={neCodigo} onChange={e => setNeCodigo(e.target.value)} style={inputStyle} />
                    <div className="flex gap-2">
                      <button onClick={crearExpediente} disabled={savingExp || !neNombre.trim()}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8', opacity: neNombre.trim() ? 1 : 0.5 }}>
                        {savingExp ? 'Guardando…' : 'Crear expediente'}
                      </button>
                      <button onClick={() => setNuevoExp(false)} className="px-3 text-xs text-[#555] hover:text-[#aaa]">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pipeline preview */}
        <div className="flex items-center gap-2 py-2">
          {[
            { label: 'BRONZE', color: '#f59e0b' },
            { label: '→', color: '#555' },
            { label: 'SILVER', color: '#34d399' },
            { label: '→', color: '#555' },
            { label: 'GOLD', color: '#fbbf24' },
          ].map((s, i) => (
            <span key={i} style={{ fontSize: 11, fontWeight: s.label.includes('→') ? 400 : 600, color: s.color }}>{s.label}</span>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 py-2.5 rounded-xl text-sm text-[#555] hover:text-[#aaa] transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            Cancelar
          </button>
          <button
            disabled={!clienteId}
            onClick={() => onConfirmar(clienteId, expedienteId || null)}
            className="flex-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: clienteId ? 'rgba(129,140,248,0.2)' : 'rgba(255,255,255,0.04)',
              border: clienteId ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(255,255,255,0.07)',
              color: clienteId ? '#818cf8' : '#555',
              cursor: clienteId ? 'pointer' : 'not-allowed',
              flex: 2,
            }}>
            ⚡ Procesar y asignar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Badge de estado por archivo ──────────────────────────────────────────────

function EstadoBadge({ estado, mensaje }: { estado: EstadoArchivo; mensaje?: string }) {
  const cfg = ESTADO_CFG[estado]
  const spinning = estado === 'subiendo' || estado === 'procesando'
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {spinning
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: cfg.color }} />
        : estado === 'bronze' || estado === 'silver' || estado === 'gold'
          ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: cfg.color }} />
          : estado === 'error'
            ? <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]" />
            : null}
      <span className="text-xs" style={{ color: cfg.color }}>{mensaje && estado === 'error' ? mensaje : cfg.label}</span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SubirDocumentosPage() {
  const [archivos, setArchivos] = useState<ArchivoItem[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const carpetaRef = useRef<HTMLInputElement>(null)

  // Modales
  const [modalModo, setModalModo] = useState(false)
  const [modalGold, setModalGold] = useState(false)
  const [modoActual, setModoActual] = useState<ModoCarga | null>(null)
  const [goldConfig, setGoldConfig] = useState<{ clienteId: string; expedienteId: string | null } | null>(null)

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
    if (nuevos.some(n => n.estado === 'pendiente')) setModalModo(true)
    setArchivos(prev => [...prev, ...nuevos])
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setArrastrando(false)
    const files: File[] = []
    for (const item of Array.from(e.dataTransfer.items)) { const f = item.getAsFile(); if (f) files.push(f) }
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

  const elegirModo = (modo: ModoCarga) => {
    setModoActual(modo)
    setModalModo(false)
    if (modo === 'directa') setModalGold(true)
  }

  const confirmarGold = (clienteId: string, expedienteId: string | null) => {
    setGoldConfig({ clienteId, expedienteId })
    setModalGold(false)
  }

  const upd = (id: string, patch: Partial<ArchivoItem>) =>
    setArchivos(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))

  // ── Carga manual ──────────────────────────────────────────────────────────
  const subirManual = async () => {
    const pendientes = archivos.filter(a => a.estado === 'pendiente')
    if (!pendientes.length) return
    setProcesando(true)
    for (const item of pendientes) {
      upd(item.id, { estado: 'subiendo' })
      const fd = new FormData(); fd.append('archivo', item.file)
      try {
        const res = await fetch('/api/bronze/upload', { method: 'POST', body: fd })
        const data = await res.json() as { nombre?: string; error?: string }
        if (!res.ok) { upd(item.id, { estado: 'error', mensaje: data.error ?? 'Error al subir' }); continue }
        upd(item.id, { estado: 'bronze' })
      } catch { upd(item.id, { estado: 'error', mensaje: 'Error de red' }) }
    }
    setProcesando(false)
  }

  // ── Carga directa ─────────────────────────────────────────────────────────
  const subirDirecta = async () => {
    if (!goldConfig) return
    const pendientes = archivos.filter(a => a.estado === 'pendiente')
    if (!pendientes.length) return
    setProcesando(true)

    for (const item of pendientes) {
      // 1. BRONZE
      upd(item.id, { estado: 'subiendo' })
      const fd = new FormData(); fd.append('archivo', item.file)
      let bronzeOk = false
      try {
        const res = await fetch('/api/bronze/upload', { method: 'POST', body: fd })
        if (res.ok) { bronzeOk = true; upd(item.id, { estado: 'bronze' }) }
        else { const d = await res.json() as { error?: string }; upd(item.id, { estado: 'error', mensaje: d.error ?? 'Error BRONZE' }); continue }
      } catch { upd(item.id, { estado: 'error', mensaje: 'Error de red' }); continue }

      if (!bronzeOk) continue

      // 2. SILVER — procesar vía /api/documentos
      upd(item.id, { estado: 'procesando' })
      const fd2 = new FormData()
      fd2.append('archivo', item.file)
      fd2.append('origenCarpeta', '/app/ingesta')
      fd2.append('actor', 'subir-directa')
      let documentoId: string | null = null
      try {
        const res2 = await fetch('/api/documentos', { method: 'POST', body: fd2 })
        const data2 = await res2.json() as { documentoId?: string; error?: string }
        if (!res2.ok && res2.status !== 409) { upd(item.id, { estado: 'error', mensaje: data2.error ?? 'Error SILVER' }); continue }
        documentoId = data2.documentoId ?? null
      } catch { upd(item.id, { estado: 'error', mensaje: 'Error de red (SILVER)' }); continue }

      if (!documentoId) { upd(item.id, { estado: 'error', mensaje: 'No se obtuvo ID del documento' }); continue }
      upd(item.id, { documentoId })

      // 3. Poll hasta LISTO
      const listo = await pollHastaListo(documentoId, (e) => {
        if (e === 'PROCESANDO') upd(item.id, { estado: 'procesando' })
      })
      if (!listo) { upd(item.id, { estado: 'error', mensaje: 'Error al clasificar' }); continue }
      upd(item.id, { estado: 'silver' })

      // 4. GOLD
      try {
        const res3 = await fetch('/api/gold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentoId,
            clienteId: goldConfig.clienteId,
            expedienteId: goldConfig.expedienteId,
            asignadoPor: 'subir-directa',
          }),
        })
        if (res3.ok) upd(item.id, { estado: 'gold' })
        else { const d = await res3.json() as { error?: string }; upd(item.id, { estado: 'error', mensaje: d.error ?? 'Error GOLD' }) }
      } catch { upd(item.id, { estado: 'error', mensaje: 'Error de red (GOLD)' }) }
    }

    setProcesando(false)
  }

  const quitar = (id: string) => setArchivos(prev => prev.filter(a => a.id !== id))
  const limpiarLista = () => { setArchivos([]); setModoActual(null); setGoldConfig(null) }

  const pendientes = archivos.filter(a => a.estado === 'pendiente').length
  const enBronze   = archivos.filter(a => a.estado === 'bronze').length
  const enSilver   = archivos.filter(a => a.estado === 'silver').length
  const enGold     = archivos.filter(a => a.estado === 'gold').length
  const errores    = archivos.filter(a => a.estado === 'error').length

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
            <span className="text-white font-medium">Manual:</span> va a <span className="text-amber-400 font-medium">BRONZE</span> y lo procesás después. &nbsp;
            <span className="text-white font-medium">Directa:</span> pasa automáticamente por <span className="text-amber-400 font-medium">BRONZE</span> → <span className="text-emerald-400 font-medium">SILVER</span> → <span className="text-yellow-300 font-medium">GOLD</span>.
          </p>
        </div>

        {/* Zona drag & drop */}
        <div
          onDragOver={e => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            arrastrando ? 'border-[#06b6d4] bg-[#06b6d4]/5' : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-[#0a0a0a]'
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#06b6d4]/10 border border-[#06b6d4]/20 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-7 h-7 text-[#06b6d4]" />
          </div>
          <p className="text-white font-medium mb-1">Arrastrá archivos aquí o hacé clic para seleccionar</p>
          <p className="text-xs text-[#555]">PDF, DOC, DOCX, TXT, MD · Max {MAX_MB}MB por archivo</p>
          <div className="flex gap-3 justify-center mt-5" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg text-sm text-[#aaa] hover:text-white transition-all min-h-[44px]">
              Seleccionar archivos
            </button>
            <button type="button" onClick={() => carpetaRef.current?.click()}
              className="px-4 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg text-sm text-[#aaa] hover:text-white transition-all flex items-center gap-2 min-h-[44px]">
              <FolderOpen className="w-4 h-4" /> Carpeta completa
            </button>
          </div>
        </div>

        <input ref={inputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.md" className="hidden" onChange={onSeleccionArchivos} />
        <input ref={carpetaRef} type="file" className="hidden" onChange={onSeleccionCarpeta}
          // @ts-expect-error atributo no estándar
          webkitdirectory="" />

        {/* Lista de archivos */}
        {archivos.length > 0 && (
          <div className="space-y-3">
            {/* Header de la lista */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#555]">{archivos.length} archivo{archivos.length !== 1 ? 's' : ''}</span>
                {enBronze > 0  && <span className="text-amber-400">· {enBronze} en BRONZE</span>}
                {enSilver > 0  && <span className="text-emerald-400">· {enSilver} en SILVER</span>}
                {enGold > 0    && <span className="text-yellow-300">· {enGold} en GOLD</span>}
                {errores > 0   && <span className="text-[#ef4444]">· {errores} con error</span>}
              </div>
              <button onClick={limpiarLista} className="text-xs text-[#555] hover:text-[#aaa] transition-colors">
                Limpiar lista
              </button>
            </div>

            {/* Modo activo badge */}
            {modoActual && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: modoActual === 'directa' ? 'rgba(129,140,248,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${modoActual === 'directa' ? 'rgba(129,140,248,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                <span>{modoActual === 'directa' ? '⚡' : '📥'}</span>
                <span style={{ color: modoActual === 'directa' ? '#818cf8' : '#f59e0b' }}>
                  {modoActual === 'directa' ? 'Carga directa — BRONZE → SILVER → GOLD' : 'Carga manual — solo BRONZE'}
                </span>
                {modoActual === 'directa' && goldConfig && (
                  <button onClick={() => setModalGold(true)} className="ml-auto text-[#555] hover:text-[#aaa] underline">cambiar destino</button>
                )}
              </div>
            )}

            {/* Lista de archivos */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              {archivos.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {iconoArchivo(item.file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{item.file.name}</p>
                    <p className="text-xs text-[#555]">
                      {formatBytes(item.file.size)}
                      {item.rutaCarpeta && <span className="ml-2">· {item.rutaCarpeta}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <EstadoBadge estado={item.estado} mensaje={item.mensaje} />
                    {item.estado === 'pendiente' && (
                      <button onClick={() => quitar(item.id)} className="text-[#333] hover:text-[#666] ml-1 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Botones de acción */}
            {pendientes > 0 && modoActual && (
              <div className="flex gap-3">
                {modoActual === 'manual' ? (
                  <button onClick={subirManual} disabled={procesando}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 min-h-[44px] transition-all"
                    style={{ background: procesando ? '#1e1e1e' : 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.35)', color: procesando ? '#555' : '#f59e0b', cursor: procesando ? 'not-allowed' : 'pointer' }}>
                    {procesando ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</> : <><Upload className="w-4 h-4" /> Subir {pendientes} archivo{pendientes !== 1 ? 's' : ''} a BRONZE</>}
                  </button>
                ) : (
                  <button onClick={subirDirecta} disabled={procesando || !goldConfig}
                    className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 min-h-[44px] transition-all"
                    style={{ background: procesando ? '#1e1e1e' : 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.35)', color: procesando ? '#555' : '#818cf8', cursor: (procesando || !goldConfig) ? 'not-allowed' : 'pointer' }}>
                    {procesando ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando pipeline…</> : <>⚡ Procesar {pendientes} archivo{pendientes !== 1 ? 's' : ''} → BRONZE → SILVER → GOLD</>}
                  </button>
                )}
              </div>
            )}

            {/* Mensajes de finalización */}
            {!procesando && pendientes === 0 && enBronze > 0 && modoActual === 'manual' && (
              <p className="text-xs text-center text-[#555]">
                Ve al <Link href="/explorador" className="text-amber-400 hover:underline">Explorador</Link> y usá <span className="text-white">⤴ Procesar en gestor</span> para indexarlos.
              </p>
            )}
            {!procesando && pendientes === 0 && enGold > 0 && (
              <p className="text-xs text-center" style={{ color: '#fbbf24' }}>
                ✓ Archivos asignados a GOLD. Podés verlos en <Link href="/explorador" className="underline hover:opacity-80">Explorador → GOLD</Link>.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {modalModo && <ModalModo onElegir={elegirModo} onCerrar={() => setModalModo(false)} />}
      {modalGold && <ModalGold onConfirmar={confirmarGold} onCerrar={() => { setModalGold(false); setModoActual('manual') }} />}
    </GestorLayout>
  )
}
