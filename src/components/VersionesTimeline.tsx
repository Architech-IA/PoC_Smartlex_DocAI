'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RotateCcw, CheckCircle2, Clock } from 'lucide-react';

export interface VersionItem {
  id: string;
  nombre: string;
  versionNumero: number;
  esVersionActual: boolean;
  creadoPor: string | null;
  tamanoBytes: number | null;
  estado: string;
  createdAt: string | Date;
}

interface Props {
  versiones: VersionItem[];
  documentoActualId: string;
  actor?: string;
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(b: number | null) {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

export default function VersionesTimeline({ versiones, documentoActualId, actor = 'sistema' }: Props) {
  const router = useRouter();
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const ordenadas = [...versiones].sort((a, b) => b.versionNumero - a.versionNumero);

  const restaurar = async (versionId: string, versionNumero: number) => {
    if (
      !confirm(
        `¿Restaurar v${versionNumero}? Se creará una nueva versión con el contenido de esa revisión. Las versiones existentes no se borran.`
      )
    )
      return;

    setRestaurando(versionId);
    setError('');
    try {
      const res = await fetch(`/api/documentos/${documentoActualId}/restaurar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId, actor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al restaurar');
      router.push(`/documentos/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al restaurar');
    } finally {
      setRestaurando(null);
    }
  };

  if (versiones.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        Este documento no tiene historial de versiones.
      </p>
    );
  }

  return (
    <div className="relative">
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-950/40 border border-red-800/50 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* línea vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-800" />

      <div className="space-y-4 ml-10">
        {ordenadas.map((v) => {
          const esActual = v.esVersionActual;
          const esEsteDoc = v.id === documentoActualId;

          return (
            <div key={v.id} className="relative">
              {/* nodo */}
              <div
                className={`absolute -left-[2.35rem] top-3 w-4 h-4 rounded-full border-2 flex items-center justify-center
                  ${esActual
                    ? 'bg-cyan-500 border-cyan-400'
                    : 'bg-gray-800 border-gray-600'
                  }`}
              />

              <div
                className={`p-3 rounded-xl border transition-colors
                  ${esActual
                    ? 'bg-gray-900 border-cyan-800/40'
                    : 'bg-gray-900/50 border-gray-800'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-100">
                        v{v.versionNumero}
                      </span>
                      {esActual && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-800/40">
                          <CheckCircle2 className="w-3 h-3" />
                          actual
                        </span>
                      )}
                      {v.estado === 'PROCESANDO' && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40">
                          <Clock className="w-3 h-3" />
                          procesando
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {fmt(v.createdAt)}
                      {v.tamanoBytes ? ` · ${formatBytes(v.tamanoBytes)}` : ''}
                      {v.creadoPor ? ` · ${v.creadoPor}` : ''}
                    </p>
                    {!esEsteDoc && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{v.nombre}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Ver / descargar */}
                    <a
                      href={`/api/documentos/${v.id}/archivo`}
                      title="Descargar esta versión"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-gray-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    {/* Restaurar — solo si no es la versión actual */}
                    {!esActual && (
                      <button
                        onClick={() => restaurar(v.id, v.versionNumero)}
                        disabled={restaurando === v.id}
                        title="Restaurar esta versión (crea una nueva versión)"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-400 hover:bg-gray-800 transition-colors disabled:opacity-40"
                      >
                        <RotateCcw className={`w-4 h-4 ${restaurando === v.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
