import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AlertaVencimiento {
  id: string;
  nombre: string;
  tipo: string;
  proyectoId: string | null;
  fechaVencimiento: string;
  diasRestantes: number;
  ventana: '30' | '60' | '90';
}

interface HuerfanoDoc {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  createdAt: Date;
  minutosEnProcesamiento?: number;
}

const CAMPOS_FECHA = [
  'fecha_vencimiento',
  'fechaVencimiento',
  'vencimiento',
  'fecha_termino',
  'fecha_fin',
  'vigencia_hasta',
];

export async function GET() {
  try {
    // datosClave es String? (JSON serializado). Traemos docs LISTO y filtramos en JS.
    const docs = await prisma.documento.findMany({
      where: { estado: 'LISTO', datosClave: { not: null } },
      select: { id: true, nombre: true, tipo: true, proyectoId: true, datosClave: true },
    });

    const ahora = new Date();
    const en90 = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000);

    const alertas: AlertaVencimiento[] = [];

    for (const doc of docs) {
      let datos: Record<string, unknown>;
      try {
        datos = JSON.parse(doc.datosClave as string);
      } catch {
        continue;
      }

      for (const campo of CAMPOS_FECHA) {
        const raw = datos[campo];
        if (!raw || typeof raw !== 'string') continue;
        const fecha = new Date(raw);
        if (isNaN(fecha.getTime())) continue;
        if (fecha < ahora || fecha > en90) continue;

        const diasRestantes = Math.ceil((fecha.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000));
        const ventana: '30' | '60' | '90' = diasRestantes <= 30 ? '30' : diasRestantes <= 60 ? '60' : '90';

        alertas.push({
          id: doc.id,
          nombre: doc.nombre,
          tipo: doc.tipo,
          proyectoId: doc.proyectoId,
          fechaVencimiento: fecha.toISOString().split('T')[0],
          diasRestantes,
          ventana,
        });
        break;
      }
    }

    alertas.sort((a, b) => a.diasRestantes - b.diasRestantes);

    // Huerfanos: sin proyectoId
    const sinProyecto = await prisma.documento.findMany({
      where: { proyectoId: null, estado: { not: 'ARCHIVADO' } },
      select: { id: true, nombre: true, tipo: true, estado: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Atascados: PROCESANDO >1h o ERROR
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

    const nowMs = Date.now();

    type DocRow = { id: string; nombre: string; tipo: string; estado: string; createdAt: Date; updatedAt?: Date };
    const huerfanos = {
      sinProyecto: sinProyecto.map((d: DocRow) => ({
        id: d.id,
        nombre: d.nombre,
        tipo: d.tipo,
        estado: d.estado,
        createdAt: d.createdAt,
      })),
      atascados: atascadosRaw.map((d: DocRow) => ({
        id: d.id,
        nombre: d.nombre,
        tipo: d.tipo,
        estado: d.estado,
        createdAt: d.createdAt,
        minutosEnProcesamiento: Math.round((nowMs - (d as { updatedAt: Date }).updatedAt.getTime()) / 60000),
      })) as HuerfanoDoc[],
    };

    return NextResponse.json({ alertas, huerfanos, generadoEn: new Date().toISOString() });
  } catch (err) {
    console.error('[dashboard/route] error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
