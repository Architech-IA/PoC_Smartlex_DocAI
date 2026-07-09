import type { Metadata } from 'next';
import './globals.css';
import BackgroundOrbs from '@/components/BackgroundOrbs';

export const metadata: Metadata = {
  title: 'Smartlex DocAI',
  description: 'Plataforma documental con IA para Smartlex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="h-full">
        <BackgroundOrbs />
        {children}
      </body>
    </html>
  );
}
