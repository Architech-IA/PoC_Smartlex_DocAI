'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard, FolderOpen, AlertTriangle, Clock, RefreshCw, Users, FileText, Activity } from 'lucide-react';
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

interface MedallionStats {
  bronze: { total: number };
  silver: { total: number };
  gold: { total: number; pendientes: number };
}

interface Evento {
  id: string;
  accion: string;
  actor: string | null;
  createdAt: string;
  documento?: { nombre: string } | null;
}

interface Cliente {
  id: string;
}

const VENTANA_COLOR: Record<string, string> = {
  '30': '#ef4444',
  '60': '#f59e0b',
  '90': '#6366f1',
};

const ACCION_COLOR: Record<string, string> = {
  CREAR: '#34d399',
  VER: '#60a5fa',
  DESCARGAR: '#818cf8',
  MODIFICAR: '#f59e0b',
  ARCHIVAR: '#6b7280',
  RESTAURAR_VERSION: '#a78bfa',
  ERROR_PROCESAMIENTO: '#f87171',
};

const ACCION_ICON: Record<string, string> = {
  CREAR: '✦',
  VER: '◎',
  DESCARGAR: '↓',
  MODIFICAR: '✎',
  ARCHIVAR: '□',
  RESTAURAR_VERSION: '↩',
  ERROR_PROCESAMIENTO: '✗',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg animate-pulse" style={{ background: 'rgba(20,20,20,0.5)' }}>
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
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border"
      style={{ background: tagColor + '0a', borderColor: tagColor + '33' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#ddd] truncate">{doc.nombre}</p>
        <p className="text-xs text-[#555] mt-0.5">
          {doc.tipo}{doc.minutosEnProcesamiento != null ? ` · ${doc.minutosEnProcesamiento}min` : ''}
        </p>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 tracking-wide"
        style={{ background: tagColor + '22', color: tagColor }}>{tag}</span>
    </div>
  );
}

const CARD: React.CSSProperties = {
  background: 'rgba(12,12,12,0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.35)',
};

export default function Shell() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [medallion, setMedallion] = useState<MedallionStats | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m, e, c] = await Promise.allSettled([
        fetch('/api/dashboard').then(r => r.json()),
        fetch('/api/medallion').then(r => r.json()),
        fetch('/api/auditoria?limit=8').then(r => r.json()),
        fetch('/api/clientes').then(r => r.json()),
      ]);
      if (d.status === 'fulfilled') setData(d.value as DashboardData);
      if (m.status === 'fulfilled') setMedallion(m.value as MedallionStats);
      if (e.status === 'fulfilled') setEventos((e.value as { eventos: Evento[] }).eventos ?? []);
      if (c.status === 'fulfilled') setClientes(Array.isArray(c.value) ? c.value : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalAlertas = data?.alertas.length ?? 0;
  const totalHuerfanos = (data?.huerfanos.sinProyecto.length ?? 0) + (data?.huerfanos.atascados.length ?? 0);
  const totalDocs = (medallion?.bronze.total ?? 0) + (medallion?.silver.total ?? 0) + (medallion?.gold.total ?? 0);
  const totalClientes = clientes.length;

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
          <div className="flex items-center gap-3">
            {data && (
              <span className="flex items-center gap-1.5 text-[#555] text-xs">
                <RefreshCw className="w-3 h-3" />
                {new Date(data.generadoEn).toLocaleString('es-CO')}
              </span>
            )}
            <button onClick={fetchAll} className="text-xs text-[#555] hover:text-white transition-colors px-2 py-1 rounded border border-[#2a2a2a] hover:border-[#444]">
              Actualizar
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Documentos', value: loading ? '—' : String(totalDocs), icon: FileText, color: '#f59e0b' },
            { label: 'Clientes', value: loading ? '—' : String(totalClientes), icon: Users, color: '#818cf8' },
            { label: 'Alertas activas', value: loading ? '—' : String(totalAlertas), icon: AlertTriangle, color: '#ef4444' },
            { label: 'Gold pendientes', value: loading ? '—' : String(medallion?.gold.pendientes ?? 0), icon: Activity, color: '#34d399' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: s.color + '10', border: '1px solid ' + s.color + '25' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color + '18' }}>
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-[10px] text-[#555] leading-tight">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Module cards */}
        <div>
          <h2 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-3">Módulos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/gestor" className="group flex flex-col gap-4 p-5 rounded-2xl transition-all"
              style={{ background: 'rgba(12,12,12,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)' }}>
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

            <Link href="/crm" className="group flex flex-col gap-4 p-5 rounded-2xl transition-all"
              style={{ background: 'rgba(12,12,12,0.5)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.4)' }}>
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-xl bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-[#6366f1]" />
                </div>
                <div className="flex items-center gap-2">
                  {totalClientes > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#6366f1]/15 text-[#6366f1]">{totalClientes} clientes</span>
                  )}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#6366f1]/15 text-[#6366f1] border border-[#6366f1]/20">Real</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">CRM</h3>
                <p className="text-sm text-[#555] mt-1 leading-relaxed">Clientes reales, documentos asignados y gestión de expedientes</p>
              </div>
              <span className="text-xs text-[#6366f1] font-medium group-hover:translate-x-0.5 transition-transform">Abrir →</span>
            </Link>
          </div>
        </div>

        {/* Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Alertas */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
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
                <><SkeletonRow /><SkeletonRow /></>
              ) : totalAlertas === 0 ? (
                <EmptyState icon={AlertTriangle} message="Sin vencimientos en los próximos 90 días" />
              ) : (
                (data?.alertas ?? []).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border"
                    style={{ background: VENTANA_COLOR[a.ventana] + '11', borderColor: VENTANA_COLOR[a.ventana] + '33' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#ddd] truncate">{a.nombre}</p>
                      <p className="text-xs text-[#555] mt-0.5">{a.tipo} · vence {a.fechaVencimiento}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: VENTANA_COLOR[a.ventana] + '22', color: VENTANA_COLOR[a.ventana] }}>
                      {a.diasRestantes}d
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Huérfanos */}
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
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
                <><SkeletonRow /><SkeletonRow /></>
              ) : totalHuerfanos === 0 ? (
                <EmptyState icon={Clock} message="Sin documentos huérfanos ni atascados" />
              ) : (
                <>
                  {(data?.huerfanos.atascados ?? []).map((d) => (
                    <HuerfanoRow key={d.id} doc={d} tag={d.estado === 'ERROR' ? 'ERROR' : 'ATASCADO'}
                      tagColor={d.estado === 'ERROR' ? '#ef4444' : '#f59e0b'} />
                  ))}
                  {(data?.huerfanos.sinProyecto ?? []).slice(0, 4).map((d) => (
                    <HuerfanoRow key={d.id} doc={d} tag="SIN CLIENTE" tagColor="#6366f1" />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={CARD}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#818cf8]" />
              <h2 className="text-sm font-semibold text-white">Actividad reciente</h2>
            </div>
            <Link href="/auditoria" className="text-xs text-[#475569] hover:text-[#818cf8] transition-colors">
              Ver todo →
            </Link>
          </div>
          {loading ? (
            <div className="flex flex-col gap-2"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
          ) : eventos.length === 0 ? (
            <EmptyState icon={Activity} message="Sin actividad registrada" />
          ) : (
            <div className="flex flex-col" style={{ gap: 0 }}>
              {eventos.map((e, i) => {
                const color = ACCION_COLOR[e.accion] ?? '#64748b';
                const icon = ACCION_ICON[e.accion] ?? '·';
                return (
                  <div key={e.id} className="flex items-start gap-3 py-2.5" style={{ borderBottom: i < eventos.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    {/* Icon */}
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: color + '18', border: '1px solid ' + color + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72em', color, flexShrink: 0, fontWeight: 700 }}>
                      {icon}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '.8em', fontWeight: 600, color }}>
                          {e.accion.replace(/_/g, ' ')}
                        </span>
                        {e.documento?.nombre && (
                          <span style={{ fontSize: '.78em', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                            {e.documento.nombre}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '.72em', color: '#334155', marginTop: 1 }}>
                        {e.actor ?? 'sistema'} · {timeAgo(e.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GestorLayout>
  );
}
