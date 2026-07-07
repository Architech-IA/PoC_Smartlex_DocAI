'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
  huerfanos: {
    sinProyecto: HuerfanoDoc[];
    atascados: HuerfanoDoc[];
  };
  generadoEn: string;
}

const VENTANA_COLOR: Record<string, string> = {
  '30': '#ef4444',
  '60': '#f59e0b',
  '90': '#6366f1',
};

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#050505',
        padding: '40px 20px',
        gap: '48px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#141414',
            border: '1px solid #222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image src="/sml26-logo.png" alt="Smartlex" width={48} height={48} style={{ objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#fff' }}>Smartlex</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555' }}>Plataforma Documental con IA</p>
        </div>
      </div>

      {/* Módulos */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <ModuleCard
          href="/gestor"
          title="Gestor Documental"
          description="Actas, contratos, búsqueda semántica y alertas de vencimiento"
          badge="IA"
          color="#f59e0b"
        />
        <ModuleCard
          href="/crm"
          title="CRM"
          description="Clientes, proyectos, facturación y reportes financieros"
          badge="Demo"
          color="#6366f1"
        />
      </div>

      {/* Panels */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {/* Alertas de vencimiento */}
        <Panel
          title="Alertas de Vencimiento"
          count={totalAlertas}
          loading={loading}
          emptyMsg="Sin vencimientos en los próximos 90 días"
          accentColor="#f59e0b"
        >
          {(data?.alertas ?? []).map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderRadius: 8,
                background: '#111',
                border: `1px solid ${VENTANA_COLOR[a.ventana]}33`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#ddd',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.nombre}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#555' }}>
                  {a.tipo} · vence {a.fechaVencimiento}
                </p>
              </div>
              <span
                style={{
                  marginLeft: 12,
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: VENTANA_COLOR[a.ventana] + '22',
                  color: VENTANA_COLOR[a.ventana],
                }}
              >
                {a.diasRestantes}d
              </span>
            </div>
          ))}
        </Panel>

        {/* Huérfanos */}
        <Panel
          title="Documentos Huérfanos"
          count={totalHuerfanos}
          loading={loading}
          emptyMsg="Sin documentos huérfanos ni atascados"
          accentColor="#6366f1"
        >
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
        </Panel>
      </div>

      {data && (
        <p style={{ fontSize: 11, color: '#333', marginTop: -24 }}>
          Actualizado: {new Date(data.generadoEn).toLocaleString('es-CO')}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  count,
  loading,
  emptyMsg,
  accentColor,
  children,
}: {
  title: string;
  count: number;
  loading: boolean;
  emptyMsg: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: '1 1 420px',
        maxWidth: 480,
        borderRadius: 16,
        border: '1px solid #1e1e1e',
        background: '#0a0a0a',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</h2>
        {count > 0 && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 12,
              background: accentColor + '22',
              color: accentColor,
            }}
          >
            {count}
          </span>
        )}
      </div>
      {loading ? (
        <p style={{ margin: 0, fontSize: 12, color: '#444' }}>Cargando...</p>
      ) : count === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: '#444' }}>{emptyMsg}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
      )}
    </div>
  );
}

function HuerfanoRow({
  doc,
  tag,
  tagColor,
}: {
  doc: HuerfanoDoc;
  tag: string;
  tagColor: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 12px',
        borderRadius: 8,
        background: '#111',
        border: `1px solid ${tagColor}22`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: '#ddd',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.nombre}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#555' }}>
          {doc.tipo}
          {doc.minutosEnProcesamiento != null ? ` · ${doc.minutosEnProcesamiento}min` : ''}
        </p>
      </div>
      <span
        style={{
          marginLeft: 12,
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 7px',
          borderRadius: 4,
          background: tagColor + '22',
          color: tagColor,
          letterSpacing: '0.03em',
        }}
      >
        {tag}
      </span>
    </div>
  );
}

function ModuleCard({
  href,
  title,
  description,
  badge,
  color,
}: {
  href: string;
  title: string;
  description: string;
  badge: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: 260,
        padding: '24px',
        borderRadius: 16,
        border: '1px solid #222',
        background: '#0a0a0a',
        textDecoration: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = color + '55';
        (e.currentTarget as HTMLAnchorElement).style.background = '#111';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = '#222';
        (e.currentTarget as HTMLAnchorElement).style.background = '#0a0a0a';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>{title}</h2>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            background: color + '22',
            color,
          }}
        >
          {badge}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.5 }}>{description}</p>
      <span style={{ fontSize: 12, color }}>Abrir</span>
    </Link>
  );
}
