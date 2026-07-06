'use client';

import CRMRuntime from '@/components/CRMRuntime';
import type { AppInstance } from '@/lib/app-types';

const app: AppInstance = {
  name: 'Smartlex',
  config: {
    companyName: 'Smartlex',
    primaryColor: 'amber',
  },
};

export default function CRMPage() {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <CRMRuntime app={app} />
    </div>
  );
}
