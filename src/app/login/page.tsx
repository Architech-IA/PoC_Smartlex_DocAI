'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar sesión');
      const from = params.get('from') ?? '/';
      router.push(from);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#07080f' }}>
      {/* Orb decorativo */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(12,12,20,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '40px 36px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Logo + nombre */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <Image src="/sml26-logo.png" alt="Smartlex" width={40} height={40} style={{ objectFit: 'contain' }} />
          </div>
          <div className="text-center">
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Smartlex DocAI</h1>
            <p style={{ color: '#475569', fontSize: 13, margin: '4px 0 0' }}>Plataforma Documental con IA</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, letterSpacing: '0.05em' }}>
              USUARIO
            </label>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              placeholder="usuario"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500, letterSpacing: '0.05em' }}>
              CONTRASEÑA
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#f87171',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              marginTop: 4,
              background: loading || !username || !password
                ? 'rgba(245,158,11,0.2)'
                : 'rgba(245,158,11,0.9)',
              color: loading || !username || !password ? '#78716c' : '#0a0a0a',
              border: 'none',
              borderRadius: 10,
              padding: '11px 0',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.03em',
            }}
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#1e293b', fontSize: 11, marginTop: 24 }}>
          Smartlex DocAI © 2026 · Architechia
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
