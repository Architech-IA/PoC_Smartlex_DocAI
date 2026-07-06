'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Participante { nombre: string; rol?: string }

interface ActaData {
  titulo: string;
  fecha: string;
  duracion?: string;
  participantes: Participante[];
  puntosTratados: string[];
  acuerdos: string[];
  proximosPasos: string[];
  resumen: string;
}

export default function ActaNuevaPage() {
  const [transcript, setTranscript] = useState('');
  const [actor, setActor] = useState('');
  const [estado, setEstado] = useState<'idle' | 'generando' | 'listo' | 'error'>('idle');
  const [acta, setActa] = useState<ActaData | null>(null);
  const [documentoId, setDocumentoId] = useState<string | null>(null);
  const [docxBase64, setDocxBase64] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function generar() {
    if (!transcript.trim()) return;
    setEstado('generando');
    setError('');
    try {
      const res = await fetch('/api/actas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: transcript, actor: actor || 'sistema' }),
      });
      const data = await res.json() as { acta?: ActaData; documentoId?: string; docxBase64?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setActa(data.acta!);
      setDocumentoId(data.documentoId!);
      setDocxBase64(data.docxBase64!);
      setEstado('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado('error');
    }
  }

  function descargarDocx() {
    if (!docxBase64 || !acta) return;
    const bytes = Uint8Array.from(atob(docxBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${acta.titulo ?? 'Acta'}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function cargarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTranscript(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Inicio</Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-xl font-semibold">Nueva Acta de Reunión</h1>
        </div>

        {estado !== 'listo' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Transcript de la reunión</label>
              <textarea
                className="w-full h-56 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 resize-none focus:outline-none focus:border-blue-500"
                placeholder="Pega el transcript aquí o carga un archivo..."
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
              />
            </div>
            <div className="flex gap-3 items-center">
              <label className="cursor-pointer text-sm text-blue-400 hover:text-blue-300 border border-blue-800 rounded px-3 py-1.5">
                Cargar archivo .txt / .md
                <input type="file" accept=".txt,.md" className="hidden" onChange={cargarArchivo} />
              </label>
              <input
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder="Tu nombre (opcional)"
                value={actor}
                onChange={e => setActor(e.target.value)}
              />
              <button
                onClick={generar}
                disabled={estado === 'generando' || !transcript.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-5 py-1.5 text-sm font-medium transition-colors"
              >
                {estado === 'generando' ? 'Generando…' : 'Generar Acta'}
              </button>
            </div>
            {estado === 'error' && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>
        )}

        {estado === 'listo' && acta && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{acta.titulo}</h2>
                <p className="text-sm text-gray-400">{acta.fecha}{acta.duracion ? ` · ${acta.duracion}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEstado('idle'); setActa(null); }}
                  className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded px-3 py-1.5"
                >
                  Nueva acta
                </button>
                <button
                  onClick={descargarDocx}
                  className="text-sm bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5"
                >
                  Descargar .docx
                </button>
                {documentoId && (
                  <Link
                    href={`/documentos/${documentoId}`}
                    className="text-sm bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1.5"
                  >
                    Ver documento
                  </Link>
                )}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumen</h3>
                <p className="text-sm text-gray-200">{acta.resumen}</p>
              </div>

              {acta.participantes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Participantes</h3>
                  <div className="flex flex-wrap gap-2">
                    {acta.participantes.map((p, i) => (
                      <span key={i} className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm">
                        {p.nombre}{p.rol ? ` — ${p.rol}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {acta.puntosTratados.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Puntos Tratados</h3>
                  <ul className="space-y-1">
                    {acta.puntosTratados.map((p, i) => (
                      <li key={i} className="text-sm text-gray-200 flex gap-2">
                        <span className="text-gray-500 shrink-0">{i + 1}.</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {acta.acuerdos.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Acuerdos y Decisiones</h3>
                  <ul className="space-y-1">
                    {acta.acuerdos.map((a, i) => (
                      <li key={i} className="text-sm text-gray-200 flex gap-2">
                        <span className="text-blue-400 shrink-0">✓</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {acta.proximosPasos.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Próximos Pasos</h3>
                  <ul className="space-y-1">
                    {acta.proximosPasos.map((p, i) => (
                      <li key={i} className="text-sm text-gray-200 flex gap-2">
                        <span className="text-amber-400 shrink-0">→</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
