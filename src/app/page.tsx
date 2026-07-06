'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Shell() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#050505',
        gap: '48px',
        padding: '40px 20px',
      }}
    >
      {/* Logo + nombre */}
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
            Smartlex
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555', fontFamily: 'system-ui, sans-serif' }}>
            Plataforma Documental con IA
          </p>
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
        transition: 'border-color 0.15s, background 0.15s',
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
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
          {title}
        </h2>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 4,
            background: color + '22',
            color,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {badge}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.5, fontFamily: 'system-ui, sans-serif' }}>
        {description}
      </p>
      <span style={{ fontSize: 12, color, fontFamily: 'system-ui, sans-serif' }}>Abrir →</span>
    </Link>
  );
}
