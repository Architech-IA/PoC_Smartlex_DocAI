'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Search, X } from 'lucide-react';
import GestorLayout from '@/components/GestorLayout';

const ACCIONES = ['CREAR', 'VER', 'DESCARGAR', 'MODIFICAR', 'ARCHIVAR', 'RESTAURAR_VERSION', 'ERROR_PROCESAMIENTO'];

const ACCION_COLOR: Record<string, string> = {
  CREAR: 'text-emerald-400',
  VER: 'text-sky-400',
  DESCARGAR: 'text-blue-400',
  MODIFICAR: 'text-amber-400',
  ARCHIVAR: 'text-gray-400',
  RESTAURAR_VERSION: 'text-purple-400',
  ERROR_PROCESAMIENTO: 'text-red-400',
};

interface Evento {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  actor: string | null;
  detalle: string | null;
  createdAt: string;
  documento?: { id: string; nombre: string } | null;
}

function fmt(d: string) {
  return new Date(d).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toCSV(eventos: Evento[]): string {
  const header = 'fecha,entidad,id,nombre,accion,actor,detalle';
  const rows = eventos.map((e) => {
    const nombre = e.documento?.nombre ?? '';
    const detalle = (e.detalle ?? '').replace(/"/g, '""');
    const actor = (e.actor ?? '').replace(/"/g, '""');
    return `"${fmt(e.createdAt)}","${e.entidad}","${e.entidadId}","${nombre}","${e.accion}","${actor}","${detalle}"`;
  });
  return [header, ...rows].join('\n');
}

function descargarCSV(eventos: Evento[]) {
  const csv = toCSV(eventos);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  // Filtros
  const [documento, setDocumento] = useState('');
  const [accionesSeleccionadas, setAccionesSeleccionadas] = useState<string[]>([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [actor, setActor] = useState('');

  const [todosParaExport, setTodosParaExport] = useState<Evento[]>([]);
  const [exportando, setExportando] = useState(false);

  const buildQuery = useCallback(
    (p: number) => {
      const q = new URLSearchParams();
      if (documento) q.set('documento', documento);
      if (accionesSeleccionadas.length > 0) q.set('accion', accionesSeleccionadas.join(','));
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (actor) q.set('actor', actor);
      q.set('page', String(p));
      q.set('limit', String(LIMIT));
      return q.toString();
    },
    [documento, accionesSeleccionadas, desde, hasta, actor]
  );

  const buscar = useCallback(
    async (p: number) => {
      setCargando(true);
      try {
        const res = await fetch(`/api/auditoria?${buildQuery(p)}`);
        const data = await res.json();
        setEventos(data.eventos ?? []);
        setTotal(data.total ?? 0);
        setPage(p);
      } finally {
        setCargando(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    buscar(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportarCSV = async () => {
    setExportando(true);
    try {
      // Traer todos los registros filtrados (hasta 2000)
      const q = new URLSearchParams();
      if (documento) q.set('documento', documento);
      if (accionesSeleccionadas.length > 0) q.set('accion', accionesSeleccionadas.join(','));
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (actor) q.set('actor', actor);
      q.set('page', '1');
      q.set('limit', '2000');
      const res = await fetch(`/api/auditoria?${q.toString()}`);
      const data = await res.json();
      descargarCSV(data.eventos ?? []);
      setTodosParaExport(data.eventos ?? []);
    } finally {
      setExportando(false);
    }
  };

  const toggleAccion = (a: string) => {
    setAccionesSeleccionadas((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const limpiarFiltros = () => {
    setDocumento('');
    setAccionesSeleccionadas([]);
    setDesde('');
    setHasta('');
    setActor('');
  };

  const totalPages = Math.ceil(total / LIMIT);
  const hayFiltros = documento || accionesSeleccionadas.length > 0 || desde || hasta || actor;

  return (
    <GestorLayout activeHref="/auditoria">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#555]">
          <a href="/" className="hover:text-[#aaa] transition-colors">Inicio</a>
          <span>/</span>
          <a href="/gestor" className="hover:text-[#aaa] transition-colors">Gestor</a>
          <span>/</span>
          <span className="text-white">Auditoria</span>
        </nav>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Auditoría</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Registro completo de acciones sobre documentos
            </p>
          </div>
          <button
            onClick={exportarCSV}
            disabled={exportando || total === 0}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 disabled:opacity-40 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Documento (nombre o id)"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-700"
              />
            </div>
            <input
              type="text"
              placeholder="Actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-700"
            />
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-700"
              title="Desde"
            />
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-cyan-700"
              title="Hasta"
            />
          </div>

          {/* Selector de acciones */}
          <div className="flex flex-wrap gap-2">
            {ACCIONES.map((a) => (
              <button
                key={a}
                onClick={() => toggleAccion(a)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors
                  ${accionesSeleccionadas.includes(a)
                    ? `${ACCION_COLOR[a]} bg-gray-800 border-gray-600`
                    : 'text-gray-500 bg-transparent border-gray-800 hover:border-gray-600'
                  }`}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => buscar(1)}
              className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg text-sm font-medium transition-colors"
            >
              Buscar
            </button>
            {hayFiltros && (
              <button
                onClick={() => {
                  limpiarFiltros();
                }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            )}
            <span className="text-xs text-gray-500 ml-auto">
              {total.toLocaleString()} eventos
            </span>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {cargando ? (
            <div className="py-12 text-center text-gray-500 text-sm">Cargando…</div>
          ) : eventos.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">Sin eventos</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Documento</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Acción</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Actor</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {eventos.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                        {fmt(ev.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        {ev.documento ? (
                          <Link
                            href={`/documentos/${ev.documento.id}`}
                            className="text-cyan-400 hover:underline truncate block text-xs"
                            title={ev.documento.nombre}
                          >
                            {ev.documento.nombre}
                          </Link>
                        ) : (
                          <span className="text-gray-500 text-xs font-mono truncate block" title={ev.entidadId}>
                            {ev.entidadId.slice(0, 12)}…
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-xs ${ACCION_COLOR[ev.accion] ?? 'text-gray-400'}`}>
                          {ev.accion}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {ev.actor ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[240px] truncate" title={ev.detalle ?? ''}>
                        {ev.detalle ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => buscar(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => buscar(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </GestorLayout>
  );
}
