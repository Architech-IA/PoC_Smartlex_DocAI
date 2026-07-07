import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface HuerfanosReport {
  sinProyecto: HuerfanoDoc[];
  atascados: HuerfanoDoc[];
  generadoEn: string;
}

export interface HuerfanoDoc {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  createdAt: Date;
  minutosEnProcesamiento?: number;
}

export async function generarReporteHuerfanos(): Promise<HuerfanosReport> {
  const sinProyecto = await prisma.documento.findMany({
    where: { proyectoId: null, estado: { not: 'ARCHIVADO' } },
    select: { id: true, nombre: true, tipo: true, estado: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const hace1Hora = new Date(Date.now() - 60 * 60 * 1000);

  const atascadosRaw = await prisma.documento.findMany({
    where: {
      OR: [
        { estado: 'PROCESANDO', updatedAt: { lt: hace1Hora } },
        { estado: 'ERROR' },
      ],
    },
    select: { id: true, nombre: true, tipo: true, estado: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
  });

  const ahora = Date.now();

  return {
    sinProyecto: sinProyecto.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      estado: d.estado,
      createdAt: d.createdAt,
    })),
    atascados: atascadosRaw.map((d) => ({
      id: d.id,
      nombre: d.nombre,
      tipo: d.tipo,
      estado: d.estado,
      createdAt: d.createdAt,
      minutosEnProcesamiento: Math.round((ahora - d.updatedAt.getTime()) / 60000),
    })),
    generadoEn: new Date().toISOString(),
  };
}

// Permite ejecutar directamente: npx tsx src/jobs/reporteHuerfanos.ts
if (require.main === module) {
  generarReporteHuerfanos()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
    })
    .finally(() => prisma.$disconnect());
}
