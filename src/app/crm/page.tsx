'use client';

import CRMRuntime from '@/components/CRMRuntime';
import type { AppInstance } from '@/lib/app-types';
import Link from 'next/link';

const app: AppInstance = {
  name: 'Smartlex',
  config: {
    companyName: 'Smartlex',
    primaryColor: 'amber',
  },
};

export default function CRMPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <Link
          href="/gestor"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al Gestor Documental
        </Link>
        <span style={{ color: '#444', fontSize: '13px' }}>|</span>
        <span style={{ color: '#666', fontSize: '13px' }}>CRM</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CRMRuntime app={app} />
      </div>
    </div>
  );
}
