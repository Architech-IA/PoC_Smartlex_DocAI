'use client';

import Link from 'next/link';

export default function GestorPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#050505',
        gap: '24px',
        padding: '40px 20px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          border: '1px dashed #333',
          borderRadius: 16,
          padding: '48px 40px',
          maxWidth: 480,
          textAlign: 'center',
          color: '#555',
        }}
      >
        <p style={{ fontSize: 32, marginBottom: 16 }}>📁</p>
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#888' }}>
          Gestor Documental
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, lineHeight: 1.6 }}>
          Esta sección se construye en las próximas sesiones: actas, contratos, búsqueda semántica y alertas de vencimiento.
        </p>
        <Link
          href="/"
          style={{
            fontSize: 13,
            color: '#f59e0b',
            textDecoration: 'none',
          }}
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
