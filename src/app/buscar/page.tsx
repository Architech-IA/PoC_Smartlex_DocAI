'use client'

import { useRef, useState } from 'react'
import { Search, MessageSquare, FileText, File, Loader2, AlertCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

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

const TIPO_COLOR: Record<string, string> = {
  CONTRATO: 'text-blue-400 bg-blue-950/40',
  ACTA: 'text-emerald-400 bg-emerald-950/40',
  FORMATO: 'text-purple-400 bg-purple-950/40',
  DOCUMENTACION_LEGAL: 'text-amber-400 bg-amber-950/40',
  OTRO: 'text-gray-400 bg-gray-800/40',
}

const CONFIANZA_COLOR: Record<string, string> = {
  ALTA: 'text-emerald-400',
  MEDIA: 'text-amber-400',
  BAJA: 'text-red-400',
}

function iconoArchivo(nombre: string) {
  if (/\.pdf$/i.test(nombre)) return <File className="w-4 h-4 text-red-400 flex-shrink-0" />
  return <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
}

function pctSimilitud(s: number) {
  return `${Math.round(s * 100)}%`
}

export default function BuscarPage() {
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<DocResultado[] | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')

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
    } catch {
      setErrorBusqueda('Error de red')
    } finally {
      setBuscando(false)
    }
  }

  const preguntar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!pregunta.trim() || chateando) return

    const textoPregunta = pregunta.trim()
    setPregunta('')
    setErrorChat('')
    setHistorial(prev => [...prev, { rol: 'usuario', texto: textoPregunta }])
    setChateando(true)

    try {
      const res = await fetch('/api/buscar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pregunta: textoPregunta }),
      })
      const data = await res.json() as {
        respuesta?: string; fuentes?: Fuente[]; confianza?: string
        documentosConsultados?: number; error?: string
      }

      if (!res.ok || !data.respuesta) {
        setHistorial(prev => [...prev, { rol: 'asistente', texto: data.error ?? 'No se pudo obtener respuesta' }])
        return
      }

      setHistorial(prev => [...prev, {
        rol: 'asistente',
        texto: data.respuesta!,
        fuentes: data.fuentes,
        confianza: data.confianza,
        docsConsultados: data.documentosConsultados,
      }])

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      setErrorChat('Error de red al procesar la pregunta')
    } finally {
      setChateando(false)
    }
  }

  const toggleFuentes = (idx: number) => {
    setFuentesAbiertas(prev => {
      const s = new Set(prev)
      s.has(idx) ? s.delete(idx) : s.add(idx)
      return s
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white">Búsqueda semántica</h1>
          <p className="text-sm text-gray-400 mt-1">
            Busca por significado, no por palabras exactas. Luego pregunta directamente sobre los documentos.
          </p>
        </div>

        {/* Buscador */}
        <form onSubmit={buscar} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Ej: "contratos con cláusula de exclusividad"'
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-100 focus:outline-none focus:border-cyan-600 placeholder:text-gray-600"
            />
          </div>
          <button
            type="submit"
            disabled={buscando || !query.trim()}
            className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors flex items-center gap-2"
          >
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar
          </button>
        </form>

        {/* Resultados */}
        {errorBusqueda && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" /> {errorBusqueda}
          </div>
        )}

        {resultados !== null && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {resultados.length === 0
                ? 'Sin resultados para esta búsqueda'
                : `${resultados.length} documento${resultados.length !== 1 ? 's' : ''} relevante${resultados.length !== 1 ? 's' : ''}`}
            </p>

            {resultados.map(doc => (
              <div key={doc.id} className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {iconoArchivo(doc.nombre)}
                    <div className="min-w-0">
                      <p className="text-sm text-gray-100 font-medium truncate">{doc.nombre}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIPO_COLOR[doc.tipo] ?? TIPO_COLOR.OTRO}`}>
                          {doc.tipo}
                        </span>
                        {doc.area && <span className="text-xs text-cyan-600">{doc.area}</span>}
                        <span className="text-xs text-gray-600">similitud {pctSimilitud(doc.similitud)}</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/documentos/${doc.id}`}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 flex-shrink-0 mt-0.5"
                  >
                    Ver <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {doc.resumen && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2 leading-relaxed">{doc.resumen}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Divisor */}
        <div className="border-t border-gray-800" />

        {/* Chat */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-500" />
            <h2 className="text-lg font-medium text-white">Pregunta sobre los documentos</h2>
          </div>

          {/* Historial */}
          {historial.length > 0 && (
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
              {historial.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                  {msg.rol === 'usuario' ? (
                    <div className="max-w-[80%] bg-cyan-600/20 border border-cyan-800/40 rounded-2xl rounded-tr-sm px-4 py-2.5">
                      <p className="text-sm text-gray-100">{msg.texto}</p>
                    </div>
                  ) : (
                    <div className="max-w-[90%] space-y-2">
                      <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.texto}</p>

                        {(msg.fuentes?.length ?? 0) > 0 && (
                          <div className="mt-3">
                            <button
                              onClick={() => toggleFuentes(idx)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              {fuentesAbiertas.has(idx) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {msg.fuentes!.length} fuente{msg.fuentes!.length !== 1 ? 's' : ''}
                              {msg.confianza && (
                                <span className={`ml-2 ${CONFIANZA_COLOR[msg.confianza] ?? ''}`}>
                                  · confianza {msg.confianza}
                                </span>
                              )}
                            </button>

                            {fuentesAbiertas.has(idx) && (
                              <div className="mt-2 space-y-1.5 border-t border-gray-800 pt-2">
                                {msg.fuentes!.map((f, fi) => (
                                  <div key={fi} className="flex items-start gap-2">
                                    <FileText className="w-3 h-3 text-gray-600 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <Link href={`/documentos/${f.id}`} className="text-xs text-cyan-400 hover:underline truncate block">
                                        {f.nombre}
                                      </Link>
                                      {f.cita && (
                                        <p className="text-xs text-gray-600 italic mt-0.5">"{f.cita}"</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {msg.docsConsultados !== undefined && (
                                  <p className="text-xs text-gray-700 mt-1">{msg.docsConsultados} documentos consultados</p>
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
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-sm text-gray-400">Analizando documentos…</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {errorChat && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" /> {errorChat}
            </div>
          )}

          {/* Input pregunta */}
          <form onSubmit={preguntar} className="flex gap-2">
            <input
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), preguntar())}
              placeholder='Ej: "¿Cuándo vence el contrato con Morales Vargas?"'
              disabled={chateando}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 focus:outline-none focus:border-cyan-600 placeholder:text-gray-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={chateando || !pregunta.trim()}
              className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-xl text-sm font-medium text-white transition-colors flex items-center gap-2"
            >
              {chateando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              Preguntar
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
