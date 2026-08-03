export interface ModuleInfo {
  href: string;
  label: string;
  emoji: string;
  color: string;
  descripcion: string;
  detalle: string[];
}

export const MODULE_INFO: ModuleInfo[] = [
  {
    href: '/',
    label: 'Dashboard',
    emoji: '🏠',
    color: '#a78bfa',
    descripcion: 'Vista general del sistema en tiempo real.',
    detalle: [
      'Documentos procesados recientemente por el watcher',
      'Estadísticas del pipeline: Bronze → Silver → Gold',
      'Actividad reciente y estado general del sistema',
    ],
  },
  {
    href: '/gestor',
    label: 'Gestor',
    emoji: '📂',
    color: '#fbbf24',
    descripcion: 'Administración completa de expedientes y documentos.',
    detalle: [
      'Listado de todos los documentos indexados',
      'Filtros por tipo, estado, fecha y cliente',
      'Acceso al contenido procesado de cada documento',
    ],
  },
  {
    href: '/documentos/subir',
    label: 'Subir Docs',
    emoji: '⬆️',
    color: '#22d3ee',
    descripcion: 'Carga de documentos para procesamiento automático con IA.',
    detalle: [
      'Acepta PDF, Word (.docx) y texto plano (.txt)',
      'El watcher detecta el archivo y lo procesa automáticamente',
      'Extrae texto, genera resumen con IA y lo indexa en el sistema',
    ],
  },
  {
    href: '/buscar',
    label: 'Buscar',
    emoji: '🔍',
    color: '#34d399',
    descripcion: 'Búsqueda sobre todos los documentos del sistema.',
    detalle: [
      'Busca por palabras clave en el contenido completo',
      'Filtra por tipo de documento, fecha y área jurídica',
      'Resultados ordenados por relevancia',
    ],
  },
  {
    href: '/actas/nueva',
    label: 'Nueva Acta',
    emoji: '📝',
    color: '#fb923c',
    descripcion: 'Generación de actas de reunión asistida por IA.',
    detalle: [
      'Describís los puntos de la reunión en lenguaje natural',
      'La IA redacta el acta en formato jurídico estructurado',
      'El documento queda guardado y disponible en el Gestor',
    ],
  },
  {
    href: '/auditoria',
    label: 'Auditoría',
    emoji: '🛡️',
    color: '#c084fc',
    descripcion: 'Registro de todas las acciones realizadas en el sistema.',
    detalle: [
      'Trazabilidad completa: quién hizo qué y cuándo',
      'Historial de documentos procesados por el pipeline',
      'Útil para cumplimiento normativo y control interno',
    ],
  },
  {
    href: '/explorador',
    label: 'Explorador',
    emoji: '🗂️',
    color: '#34d399',
    descripcion: 'Navegador de archivos del pipeline de datos.',
    detalle: [
      'Estructura Bronze / Silver / Gold del sistema medallion',
      'Bronze: archivos originales tal como se subieron',
      'Silver/Gold: versiones procesadas y enriquecidas por la IA',
    ],
  },
  {
    href: '/clientes',
    label: 'Clientes',
    emoji: '👥',
    color: '#60a5fa',
    descripcion: 'Gestión de clientes vinculados a los expedientes.',
    detalle: [
      'Perfil de cada cliente con sus documentos asociados',
      'Historial de expedientes por cliente',
      'Integración futura con CRM (en desarrollo)',
    ],
  },
  {
    href: '/vault',
    label: 'Vault',
    emoji: '🧠',
    color: '#818cf8',
    descripcion: 'Segundo Cerebro: notas automáticas de cada documento procesado.',
    detalle: [
      'El sistema genera una nota .md por cada documento analizado',
      'Cada nota incluye resumen, metadatos y área jurídica',
      'Compatible con Obsidian — sincronizable con Notion (próximamente)',
    ],
  },
  {
    href: '/sesiones',
    label: 'Sesiones',
    emoji: '🔒',
    color: '#f472b6',
    descripcion: 'Panel de trazabilidad de acceso (solo administradores).',
    detalle: [
      'Registro de cada inicio de sesión: usuario, rol, IP y dispositivo',
      'Últimas 200 sesiones ordenadas cronológicamente',
      'Visible únicamente para el perfil admin',
    ],
  },
];

export function getModuleInfo(pathname: string): ModuleInfo | undefined {
  // exact match first, then prefix
  return (
    MODULE_INFO.find(m => m.href === pathname) ??
    MODULE_INFO.find(m => m.href !== '/' && pathname.startsWith(m.href))
  );
}
