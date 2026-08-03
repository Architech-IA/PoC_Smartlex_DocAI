'use client';

import Link from 'next/link';
import GestorLayout from '@/components/GestorLayout';
import { MODULE_INFO } from '@/lib/moduleInfo';

export default function AyudaPage() {
  return (
    <GestorLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.6em', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>
            Guía de módulos
          </h1>
          <p style={{ fontSize: '.9em', color: '#475569', margin: 0 }}>
            Descripción de cada sección de la plataforma Smartlex DocAI.
          </p>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {MODULE_INFO.map(mod => (
            <div
              key={mod.href}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: '20px 20px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${mod.color}0d`;
                (e.currentTarget as HTMLElement).style.borderColor = `${mod.color}40`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              {/* Icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: `${mod.color}1a`, border: `1px solid ${mod.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25em',
                }}>
                  {mod.emoji}
                </div>
                <span style={{ fontWeight: 700, fontSize: '.95em', color: '#e2e8f0' }}>{mod.label}</span>
              </div>

              {/* Description */}
              <p style={{ fontSize: '.83em', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                {mod.descripcion}
              </p>

              {/* Detail bullets */}
              <ul style={{ margin: 0, padding: '0 0 0 1em', listStyle: 'disc' }}>
                {mod.detalle.map((d, i) => (
                  <li key={i} style={{ fontSize: '.78em', color: '#475569', marginBottom: 3, lineHeight: 1.45 }}>{d}</li>
                ))}
              </ul>

              {/* Link */}
              <Link
                href={mod.href}
                style={{
                  marginTop: 4, fontSize: '.78em', fontWeight: 600,
                  color: mod.color, textDecoration: 'none', letterSpacing: '.04em',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                Ir al módulo →
              </Link>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 40, padding: '16px 20px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
          <p style={{ fontSize: '.8em', color: '#6366f1', margin: 0, lineHeight: 1.6 }}>
            <strong>💡 Tip:</strong> En cada módulo encontrás un botón <strong>ⓘ</strong> en la esquina superior derecha que muestra esta información contextual.
          </p>
        </div>
      </div>
    </GestorLayout>
  );
}
