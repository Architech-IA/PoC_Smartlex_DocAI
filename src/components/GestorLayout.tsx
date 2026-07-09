'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; icon: string };

const NAV_LINKS: NavItem[] = [
  { href: '/',                  label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/gestor',            label: 'Gestor',      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/documentos/subir',  label: 'Subir Docs',  icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { href: '/buscar',            label: 'Buscar',      icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { href: '/actas/nueva',       label: 'Nueva Acta',  icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { href: '/auditoria',         label: 'Auditoría',   icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { href: '/explorador',        label: 'Explorador',  icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/clientes',          label: 'Clientes',    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
];

const MODULE_COLORS: Record<string, { icon: string; bg: string; border: string; glow: string }> = {
  '/':                  { icon: '#a78bfa', bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.3)',   glow: '0 0 14px rgba(139,92,246,0.35)'  },
  '/gestor':            { icon: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',   glow: '0 0 14px rgba(245,158,11,0.35)'  },
  '/documentos/subir':  { icon: '#22d3ee', bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.3)',    glow: '0 0 14px rgba(6,182,212,0.35)'   },
  '/buscar':            { icon: '#34d399', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)',   glow: '0 0 14px rgba(16,185,129,0.35)'  },
  '/actas/nueva':       { icon: '#fb923c', bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.3)',   glow: '0 0 14px rgba(251,146,60,0.35)'  },
  '/auditoria':         { icon: '#c084fc', bg: 'rgba(192,132,252,0.15)', border: 'rgba(192,132,252,0.3)',  glow: '0 0 14px rgba(192,132,252,0.35)' },
  '/explorador':        { icon: '#34d399', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  glow: '0 0 14px rgba(16,185,129,0.35)'  },
  '/clientes':          { icon: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)',  glow: '0 0 14px rgba(96,165,250,0.35)'  },
};
const DEFAULT_MC = { icon: '#64748b', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.07)', glow: '' };

const BRAND        = '#f59e0b';
const BRAND_L      = '#fbbf24';
const BRAND_DIM    = 'rgba(245,158,11,0.14)';
const BRAND_BORDER = 'rgba(245,158,11,0.28)';

// Liquid glass sidebar style
const GLASS_BG     = 'rgba(4,4,14,0.55)';
const GLASS_BLUR   = 'blur(32px) saturate(200%)';
const GLASS_BORDER = '1px solid rgba(255,255,255,0.09)';
const GLASS_SHADOW = 'inset 0 1px 0 rgba(255,255,255,0.10), inset 1px 0 0 rgba(255,255,255,0.04), 4px 0 40px rgba(0,0,0,0.35)';

// Typography
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export default function GestorLayout({ children }: { children: React.ReactNode; activeHref?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sml-sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      localStorage.setItem('sml-sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  function NavLink({ item, isCol }: { item: NavItem; isCol: boolean }) {
    const active = isActive(item.href);
    const mc = MODULE_COLORS[item.href] ?? DEFAULT_MC;
    return (
      <Link
        href={item.href}
        title={isCol ? item.label : undefined}
        className="flex items-center rounded-xl transition-all relative group"
        style={{
          fontSize: '11px',
          fontWeight: active ? 600 : 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase' as const,
          gap: isCol ? '0' : '9px',
          padding: isCol ? '7px 0' : '6px 9px',
          justifyContent: isCol ? 'center' : 'flex-start',
          color: active ? BRAND_L : 'rgba(226,232,240,0.85)',
          background: active
            ? 'linear-gradient(90deg,rgba(245,158,11,0) 0%,rgba(245,158,11,0.07) 35%,rgba(245,158,11,0.22) 100%)'
            : 'transparent',
          border: active ? ('1px solid ' + BRAND_BORDER) : '1px solid transparent',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement;
            el.style.color = '#ffffff';
            el.style.background = 'rgba(255,255,255,0.05)';
            el.style.border = '1px solid rgba(255,255,255,0.08)';
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement;
            el.style.color = 'rgba(226,232,240,0.85)';
            el.style.background = 'transparent';
            el.style.border = '1px solid transparent';
          }
        }}
      >
        {/* Active left bar */}
        {active && !isCol && (
          <span
            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
            style={{ background: 'linear-gradient(180deg,' + BRAND_L + ',' + BRAND + ')' }}
          />
        )}
        {/* Icon container */}
        <span
          className="flex items-center justify-center rounded-lg flex-shrink-0 transition-all"
          style={{
            width: '24px', height: '24px',
            background: active ? mc.bg : 'rgba(255,255,255,0.04)',
            border: '1px solid ' + (active ? mc.border : 'rgba(255,255,255,0.07)'),
            boxShadow: active ? mc.glow : 'none',
            backdropFilter: active ? 'blur(8px)' : 'none',
          }}
        >
          <svg
            style={{ color: active ? mc.icon : '#64748b', width: '14px', height: '14px', transition: 'color 0.15s ease' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.75} d={item.icon} />
          </svg>
        </span>
        {/* Label */}
        {!isCol && (
          <span style={{ flex: 1 }}>{item.label}</span>
        )}
        {/* Active dot */}
        {!isCol && active && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: BRAND, boxShadow: '0 0 8px ' + BRAND }}
          />
        )}
      </Link>
    );
  }

  function SidebarContent({ forceExpanded = false }: { forceExpanded?: boolean }) {
    const isCol = !forceExpanded && collapsed && !isMobile;
    return (
      <>
        {/* Header */}
        <div
          className="flex items-center justify-between px-3"
          style={{
            height: '56px',
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          {!isCol ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-xl"
                style={{
                  width: '32px', height: '32px',
                  background: BRAND_DIM,
                  border: '1px solid ' + BRAND_BORDER,
                  boxShadow: '0 0 18px rgba(245,158,11,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Image src="/sml26-logo.png" alt="Smartlex" width={22} height={22} style={{ objectFit: 'contain' }} />
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className="font-bold truncate"
                  style={{
                    fontSize: '12px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    background: 'linear-gradient(135deg,' + BRAND_L + ' 0%,' + BRAND + ' 55%,#fb923c 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Smartlex
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(148,163,184,0.6)', letterSpacing: '0.06em', fontWeight: 500, textTransform: 'uppercase' }}>
                  DocAI
                </span>
              </div>
            </div>
          ) : (
            <button
              onClick={toggleCollapse}
              title="Expandir"
              className="mx-auto flex items-center justify-center rounded-xl transition-all"
              style={{
                width: '36px', height: '36px',
                background: BRAND_DIM,
                border: '1px solid ' + BRAND_BORDER,
                boxShadow: '0 0 18px rgba(245,158,11,0.25)',
              }}
            >
              <Image src="/sml26-logo.png" alt="Smartlex" width={24} height={24} style={{ objectFit: 'contain' }} />
            </button>
          )}

          {!isCol && !isMobile && (
            <button
              onClick={toggleCollapse}
              title="Colapsar sidebar"
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
              style={{ color: '#475569', background: 'transparent', border: '1px solid transparent' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = BRAND_L; el.style.background = BRAND_DIM; el.style.border = '1px solid ' + BRAND_BORDER; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#475569'; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}

          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ color: '#64748b' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '10px 8px 8px' }}>
          {!isCol && (
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(100,116,139,0.7)', textTransform: 'uppercase', padding: '0 4px 6px', marginBottom: '2px' }}>
              Navegación
            </p>
          )}

          <div className="space-y-0.5">
            {NAV_LINKS.map(item => <NavLink key={item.href} item={item} isCol={isCol} />)}
          </div>

          {/* Portal link */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {!isCol && (
              <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(100,116,139,0.7)', textTransform: 'uppercase', padding: '0 4px 6px' }}>
                Ecosistema
              </p>
            )}
            <a
              href="https://portal.architechia.co/hub"
              target="_blank"
              rel="noopener noreferrer"
              title={isCol ? 'Portal ArchiTechIA' : undefined}
              className="flex items-center rounded-xl transition-all"
              style={{
                fontSize: '11px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                gap: isCol ? '0' : '9px',
                padding: isCol ? '7px 0' : '6px 9px',
                justifyContent: isCol ? 'center' : 'flex-start',
                color: 'rgba(148,163,184,0.7)', textDecoration: 'none', whiteSpace: 'nowrap',
                border: '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#cbd5e1'; el.style.background = 'rgba(255,255,255,0.05)'; el.style.border = '1px solid rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'rgba(148,163,184,0.7)'; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
            >
              <span
                className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </span>
              {!isCol && 'Portal ArchiTechIA'}
            </a>
          </div>
        </nav>

        {/* Footer */}
        {!isCol && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: '10px', color: 'rgba(100,116,139,0.5)', letterSpacing: '0.03em', textAlign: 'center' }}>
              Smartlex DocAI © 2026
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: 'transparent', fontFamily: FONT }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          style={{
            width: collapsed ? '60px' : '210px',
            minWidth: collapsed ? '60px' : '210px',
            background: GLASS_BG,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
            borderRight: GLASS_BORDER,
            boxShadow: GLASS_SHADOW,
            transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
            overflow: 'hidden',
            zIndex: 30,
          }}
          className="flex flex-col flex-shrink-0"
        >
          <SidebarContent />
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <aside
          className="fixed top-0 left-0 h-full z-50 flex flex-col"
          style={{
            width: '260px',
            background: GLASS_BG,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
            borderRight: GLASS_BORDER,
            boxShadow: GLASS_SHADOW,
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <SidebarContent forceExpanded />
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ zIndex: 1 }}>
        {/* Mobile top bar */}
        {isMobile && (
          <header
            className="flex items-center gap-3 px-4 py-3 sticky top-0 z-20"
            style={{
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(20px) saturate(180%)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
              fontFamily: FONT,
            }}
          >
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center rounded-lg"
              style={{ minWidth: '40px', minHeight: '40px', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Abrir menu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: '28px', height: '28px', background: BRAND_DIM, border: '1px solid ' + BRAND_BORDER }}
            >
              <Image src="/sml26-logo.png" alt="Smartlex" width={20} height={20} style={{ objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: BRAND_L }}>Smartlex</span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>DocAI</span>
          </header>
        )}

        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'transparent' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
