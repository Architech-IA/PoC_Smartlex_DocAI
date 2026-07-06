import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Smartlex DocAI',
  description: 'Plataforma documental con IA para Smartlex',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="h-full">{children}</body>
    </html>
  );
}
