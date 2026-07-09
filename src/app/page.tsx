'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, FolderOpen, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import GestorLayout from '@/components/GestorLayout';

interface AlertaVencimiento {
  id: string;
  nombre: string;
  tipo: string;
  proyectoId: string | null;
  fechaVencimiento: string;
  diasRestantes: number;
  ventana: '30' | '60' | '90';
}

interface HuerfanoDoc {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  createdAt: string;
  minutosEnProcesamiento?: number;
}

interface DashboardData {
  alertas: AlertaVencimiento[];
  huerfanos: { sinProyecto: HuerfanoDoc[]; atascados: HuerfanoDoc[] };
  generadoEn: string;
}

const VENTANA_COLOR: Record<string, string> = {
  '30': '#ef4444',
  '60': '#f59e0b',
  '90': '#6366f1',
};

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse" style={{ background: "rgba(20,20,20,0.5)" }}>
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[#1e1e1e] rounded w-3/4" />
        <div className="h-2 bg-[#1e1e1e] rounded w-1/2" />
      </div>
      <div className="h-5 w-10 bg-[#1e1e1e] rounded" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
      <div className="w-10 h-10 rounded-full bg-[#111] border border-[#2a2a2a] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#555]" />
      </div>
      <p className="text-sm text-[#555]">{message}</p>
    </div>
  );
}

function HuerfanoRow({ doc, tag, tagColor }: { doc: HuerfanoDoc; tag: string; tagColor: string }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border"
      style={{ background: tagColor + '0a', borderColor: tagColor + '33' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#ddd] truncate">{doc.nombre}</p>
        <p className="text-xs text-[#555] mt-0.5">
          {doc.tipo}
          {doc.minutosEnProcesamiento != null ? ` · ${doc.minutosEnProcesamiento}min` : ''}
        </p>
      </div>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 tracking-wide"
        style={{ background: tagColor + '22', color: tagColor }}
      >
        {tag}
      </span>
    </div>
  );
}

export default function Shell() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const totalAlertas = data?.alertas.length ?? 0;
  const totalHuerfanos =
    (data?.huerfanos.sinProyecto.length ?? 0) + (data?.huerfanos.atascados.length ?? 0);

  return (
    <GestorLayout activeHref="/">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#111] border border-[#2a2a2a] flex items-center justify-center overflow-hidden">
              <Image src="/sml26-logo.png" alt="Smartlex" width={32} height={32} style={{ objectFit: 'contain' }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">Smartlex DocAI</h1>
              <p className="text-xs text-[#555]">Plataforma Documental con IA</p>
            </div>
          </div>
          {data && (
            <div className="flex items-center gap-1.5 text-[#555] text-xs">
              <RefreshCw className="w-3 h-3" />
              <span>Actualizado: {new Date(data.generadoEn).toLocaleString('es-CO')}</span>
            </div>
          )}
        </div>

        {/* Module cards */}
        <div>
          <h2 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">Módulos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/gestor"
              className="group flex flex-col gap-4 p-5 rounded-2xl transition-all" style={{ background: "rgba(12,12,12,0.5)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)" }}
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-[#f59e0b]" />
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/20">IA</span>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">Gestor Documental</h3>
                <p className="text-sm text-[#555] mt-1 leading-relaxed">Actas, contratos, búsqueda semántica y alertas de vencimiento</p>
              </div>
              <span className="text-xs text-[#f59e0b] font-medium group-hover:translate-x-0.5 transition-transform">Abrir →</span>
            </Link>

            <Link
              href="/crm"
              className="group flex flex-col gap-4 p-5 rounded-2xl transition-all" style={{ background: "rgba(12,12,12,0.5)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)" }}
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-[#6366f1]" />
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/20">Demo</span>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">CRM</h3>
                <p className="text-sm text-[#555] mt-1 leading-relaxed">Clientes, proyectos, facturación y reportes financieros</p>
              </div>
              <span className="text-xs text-[#6366f1] font-medium group-hover:translate-x-0.5 transition-transform">Abrir →</span>
            </Link>
          </div>
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alertas */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "rgba(12,12,12,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.35)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                <h2 className="text-sm font-semibold text-white">Alertas de Vencimiento</h2>
              </div>
              {totalAlertas > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">{totalAlertas}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : totalAlertas === 0 ? (
                <EmptyState icon={AlertTriangle} message="Sin vencimientos en los próximos 90 días" />
              ) : (
                (data?.alertas ?? []).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border"
                    style={{
                      background: VENTANA_COLOR[a.ventana] + '11',
                      borderColor: VENTANA_COLOR[a.ventana] + '33',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#ddd] truncate">{a.nombre}</p>
                      <p className="text-xs text-[#555] mt-0.5">{a.tipo} · vence {a.fechaVencimiento}</p>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: VENTANA_COLOR[a.ventana] + '22', color: VENTANA_COLOR[a.ventana] }}
                    >
                      {a.diasRestantes}d
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Huérfanos */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "rgba(12,12,12,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.35)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6366f1]" />
                <h2 className="text-sm font-semibold text-white">Documentos Huérfanos</h2>
              </div>
              {totalHuerfanos > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#6366f1]/15 text-[#6366f1]">{totalHuerfanos}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {loading ? (
                <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>
              ) : totalHuerfanos === 0 ? (
                <EmptyState icon={Clock} message="Sin documentos huérfanos ni atascados" />
              ) : (
                <>
                  {(data?.huerfanos.atascados ?? []).map((d) => (
                    <HuerfanoRow
                      key={d.id}
                      doc={d}
                      tag={d.estado === 'ERROR' ? 'ERROR' : 'ATASCADO'}
                      tagColor={d.estado === 'ERROR' ? '#ef4444' : '#f59e0b'}
                    />
                  ))}
                  {(data?.huerfanos.sinProyecto ?? []).map((d) => (
                    <HuerfanoRow key={d.id} doc={d} tag="SIN PROYECTO" tagColor="#6366f1" />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </GestorLayout>
  );
}
