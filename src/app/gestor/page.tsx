'use client';

import Link from 'next/link';

const acciones = [
  { href: '/actas/nueva', label: 'Nueva Acta', desc: 'Genera un acta estructurada desde un transcript de reunión', badge: 'IA', color: '#f59e0b' },
  { href: '/documentos/subir', label: 'Subir Documentos', desc: 'Carga contratos, formatos o actas antiguas — se clasifican automáticamente', badge: 'Próximo', color: '#6b7280' },
  { href: '/buscar', label: 'Búsqueda Semántica', desc: 'Encuentra documentos por significado y haz preguntas sobre el acervo', badge: 'Próximo', color: '#6b7280' },
  { href: '/auditoria', label: 'Auditoría', desc: 'Log completo de acciones sobre cada documento', badge: 'Nuevo', color: '#8b5cf6' },
];

export default function GestorPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Inicio</Link>
          <span className="text-gray-600">/</span>
          <h1 className="text-xl font-semibold">Gestor Documental</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {acciones.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm text-white">{a.label}</span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: a.color + '22', color: a.color }}
                >
                  {a.badge}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{a.desc}</p>
              <span className="text-xs mt-3 block" style={{ color: a.color }}>Abrir →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
