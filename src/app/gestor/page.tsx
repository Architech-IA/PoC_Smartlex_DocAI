'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileEdit, Upload, Search, Shield, ArrowRight, FolderOpen, TrendingUp } from 'lucide-react';
import GestorLayout from '@/components/GestorLayout';

interface DashboardStats {
  alertas: { id: string }[];
  huerfanos: { sinProyecto: { id: string }[]; atascados: { id: string }[] };
}

interface MedallionStats {
  bronze: { total: number; porEstado: Record<string, number> };
  silver: { total: number; porEstado: Record<string, number> };
  gold: { total: number; pendientes: number };
  porSocio: { socio: string; total: number }[];
}

const acciones = [
  { href: '/actas/nueva', label: 'Nueva Acta', desc: 'Genera un acta estructurada desde un transcript de reunion', badge: 'IA', color: '#f59e0b', icon: FileEdit },
  { href: '/documentos/subir', label: 'Subir Documentos', desc: 'Carga contratos o actas. El sistema los clasifica y vectoriza automaticamente', badge: 'Nuevo', color: '#06b6d4', icon: Upload },
  { href: '/buscar', label: 'Busqueda Semantica', desc: 'Encuentra documentos por significado. Pregunta directamente al acervo', badge: 'IA', color: '#06b6d4', icon: Search },
  { href: '/auditoria', label: 'Auditoria', desc: 'Log completo de todas las acciones sobre cada documento. Exportable a CSV', badge: 'Trazabilidad', color: '#6366f1', icon: Shield },
];

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(12,12,20,0.45)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)',
  borderRadius: 16,
  minHeight: 180,
};

export default function GestorPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [medallion, setMedallion] = useState<MedallionStats | null>(null);

  useEffect(() => {
    fetch('/api/dashboard').then((r) => r.json()).then((d) => setStats(d)).catch(() => null);
    fetch('/api/medallion').then((r) => r.json()).then((d) => setMedallion(d as MedallionStats)).catch(() => null);
  }, []);

  const totalAlertas = stats?.alertas.length ?? 0;
  const totalHuerfanos = (stats?.huerfanos.sinProyecto.length ?? 0) + (stats?.huerfanos.atascados.length ?? 0);

  return (
    <GestorLayout activeHref="/gestor">
      <div className="max-w-4xl mx-auto space-y-8">
        <nav className="flex items-center gap-2 text-sm" style={{ color: '#555' }}>
          <Link href="/" style={{ color: '#555' }} className="hover:text-white transition-colors">Inicio</Link>
          <span>/</span>
          <span className="text-white">Gestor</span>
        </nav>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', backdropFilter: 'blur(10px)' }}>
              <FolderOpen className="w-7 h-7" style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Gestor Documental</h1>
              <p className="text-sm mt-0.5" style={{ color: '#555' }}>Administra tu acervo documental con asistencia de IA</p>
            </div>
          </div>
          {stats && (totalAlertas > 0 || totalHuerfanos > 0) && (
            <div className="flex gap-3">
              {totalAlertas > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', backdropFilter: 'blur(10px)' }}>
                  <TrendingUp className="w-4 h-4" style={{ color: '#f59e0b' }} />
                  <span className="text-xs font-semibold" style={{ color: '#f59e0b' }}>{totalAlertas} alerta{totalAlertas !== 1 ? 's' : ''}</span>
                </div>
              )}
              {totalHuerfanos > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', backdropFilter: 'blur(10px)' }}>
                  <FolderOpen className="w-4 h-4" style={{ color: '#6366f1' }} />
                  <span className="text-xs font-semibold" style={{ color: '#6366f1' }}>{totalHuerfanos} huerfano{totalHuerfanos !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {acciones.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.href} href={a.href}
                className="group flex flex-col gap-5 p-6 transition-all"
                style={GLASS_CARD}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.border = '1px solid ' + a.color + '44';
                  el.style.background = 'rgba(18,18,28,0.55)';
                  el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.border = '1px solid rgba(255,255,255,0.07)';
                  el.style.background = 'rgba(12,12,20,0.45)';
                  el.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)';
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: a.color + '18', border: '1px solid ' + a.color + '35', backdropFilter: 'blur(8px)' }}>
                    <Icon className="w-6 h-6" style={{ color: a.color }} />
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg tracking-wide"
                    style={{ background: a.color + '18', color: a.color, border: '1px solid ' + a.color + '30' }}>
                    {a.badge}
                  </span>
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-white mb-1.5">{a.label}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#555' }}>{a.desc}</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: a.color }}>
                  Abrir
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Medallion Funnel ── */}
        {medallion && (
          <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(10,10,18,0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-sm font-semibold text-white">Pipeline Medallion</h2>
            {/* Funnel */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '🥉 Bronze', total: medallion.bronze.total, sub: `${medallion.bronze.porEstado['ENVIADO_A_SILVER'] ?? 0} enviados a silver`, color: '#b45309', bg: 'rgba(180,83,9,0.12)', border: 'rgba(180,83,9,0.25)' },
                { label: '🥈 Silver', total: medallion.silver.total, sub: `${medallion.silver.porEstado['LISTO'] ?? 0} listos · ${medallion.silver.porEstado['ERROR'] ?? 0} errores`, color: '#1d4ed8', bg: 'rgba(29,78,216,0.12)', border: 'rgba(29,78,216,0.25)' },
                { label: '🥇 Gold', total: medallion.gold.total, sub: `${medallion.gold.pendientes} pendientes de asignar`, color: '#b45309', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', href: '/gold' },
              ].map(({ label, total, sub, color, bg, border, href }) => (
                <div key={label} className="rounded-xl p-4 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                  <p className="text-xs font-semibold mb-1" style={{ color }}>{label}</p>
                  <p className="text-2xl font-bold text-white">{total}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(100,116,139,0.7)' }}>{sub}</p>
                  {href && total === 0 && medallion.gold.pendientes > 0 && (
                    <a href={href} className="text-xs mt-2 inline-block" style={{ color }}>{medallion.gold.pendientes} docs sin asignar →</a>
                  )}
                </div>
              ))}
            </div>
            {/* Por socio */}
            {medallion.porSocio.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(100,116,139,0.6)' }}>DOCUMENTOS POR SOCIO</p>
                <div className="flex flex-col gap-1.5">
                  {medallion.porSocio.map(({ socio, total: t }) => {
                    const max = medallion.porSocio[0]?.total ?? 1;
                    return (
                      <div key={socio} className="flex items-center gap-3">
                        <span className="text-xs w-28 flex-shrink-0" style={{ color: '#94a3b8' }}>{socio}</span>
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${(t / max) * 100}%`, background: '#f59e0b' }} />
                        </div>
                        <span className="text-xs w-6 text-right" style={{ color: '#fbbf24' }}>{t}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-start gap-4 p-5 rounded-2xl"
          style={{ background: 'rgba(10,10,18,0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <TrendingUp className="w-4 h-4" style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <p className="text-sm font-medium text-white mb-1">Flujo recomendado</p>
            <p className="text-sm leading-relaxed" style={{ color: '#555' }}>Subi tus documentos primero, luego usa la Busqueda Semantica para encontrarlos por contenido. Las Actas se generan desde un transcript y quedan indexadas automaticamente.</p>
          </div>
        </div>
      </div>
    </GestorLayout>
  );
}
