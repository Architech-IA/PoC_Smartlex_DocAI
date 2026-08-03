'use client';

import { useEffect, useState } from 'react';
import GestorLayout from '@/components/GestorLayout';

interface Sesion {
  id: string;
  username: string;
  rol: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

function rolBadge(rol: string) {
  const isAdmin = rol === 'admin';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
      padding: '2px 8px', borderRadius: 20,
      background: isAdmin ? 'rgba(245,158,11,0.15)' : 'rgba(96,165,250,0.15)',
      border: `1px solid ${isAdmin ? 'rgba(245,158,11,0.35)' : 'rgba(96,165,250,0.35)'}`,
      color: isAdmin ? '#fbbf24' : '#60a5fa',
    }}>
      {rol}
    </span>
  );
}

export default function SesionesPage() {
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/sesiones')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { setSesiones(data); setLoading(false); })
      .catch(e => { setError(e === 403 ? 'Acceso restringido a administradores.' : 'Error al cargar sesiones.'); setLoading(false); });
  }, []);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    }).format(new Date(iso));

  const parseDevice = (ua: string | null) => {
    if (!ua) return 'Desconocido';
    if (/mobile/i.test(ua)) return 'Móvil';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Escritorio';
  };

  return (
    <GestorLayout>
      <div style={{ fontFamily: FONT, maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
            Trazabilidad de Sesiones
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.7)', marginTop: 4 }}>
            Registro de cada inicio de sesión en la plataforma · Solo visible para administradores
          </p>
        </div>

        {/* Stats rápidos */}
        {!loading && !error && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' as const }}>
            {[
              { label: 'Total sesiones', value: sesiones.length },
              { label: 'Últimas 24h', value: sesiones.filter(s => new Date(s.createdAt) > new Date(Date.now() - 86400000)).length },
              { label: 'Usuarios únicos', value: new Set(sesiones.map(s => s.username)).size },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 20px', minWidth: 130,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fbbf24' }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Contenido */}
        {loading && (
          <div style={{ textAlign: 'center' as const, padding: 60, color: 'rgba(148,163,184,0.5)', fontSize: 14 }}>
            Cargando sesiones...
          </div>
        )}
        {error && (
          <div style={{ textAlign: 'center' as const, padding: 60, color: '#f87171', fontSize: 14 }}>{error}</div>
        )}
        {!loading && !error && (
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Fecha y hora', 'Usuario', 'Rol', 'IP', 'Dispositivo'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left' as const,
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const, color: 'rgba(100,116,139,0.8)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sesiones.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' as const, color: 'rgba(148,163,184,0.4)' }}>Sin registros aún</td></tr>
                )}
                {sesiones.map((s, i) => (
                  <tr key={s.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}>
                    <td style={{ padding: '9px 14px', color: '#94a3b8', whiteSpace: 'nowrap' as const }}>{fmt(s.createdAt)}</td>
                    <td style={{ padding: '9px 14px', color: '#e2e8f0', fontWeight: 600 }}>{s.username}</td>
                    <td style={{ padding: '9px 14px' }}>{rolBadge(s.rol)}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(148,163,184,0.6)', fontFamily: 'monospace' }}>{s.ip ?? '—'}</td>
                    <td style={{ padding: '9px 14px', color: 'rgba(148,163,184,0.5)' }}>{parseDevice(s.userAgent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GestorLayout>
  );
}
