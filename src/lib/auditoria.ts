import { prisma } from '@/lib/prisma';

interface LogEventoParams {
  entidad: 'DOCUMENTO' | 'PROYECTO';
  entidadId: string;
  accion:
    | 'CREAR'
    | 'VER'
    | 'DESCARGAR'
    | 'MODIFICAR'
    | 'ARCHIVAR'
    | 'RESTAURAR_VERSION'
    | 'ERROR_PROCESAMIENTO';
  actor?: string;
  detalle?: string;
}

export async function logEvento(params: LogEventoParams): Promise<void> {
  try {
    await prisma.eventoAuditoria.create({
      data: {
        entidad: params.entidad,
        entidadId: params.entidadId,
        accion: params.accion,
        actor: params.actor ?? 'sistema',
        detalle: params.detalle ?? null,
      },
    });
  } catch (err) {
    // El fallo de auditoría no debe bloquear el flujo principal.
    console.error('[auditoria] Error al escribir EventoAuditoria:', err);
  }
}
