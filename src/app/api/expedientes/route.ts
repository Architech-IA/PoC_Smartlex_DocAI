import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('clienteId');

  if (!clienteId) {
    return NextResponse.json({ error: 'clienteId requerido' }, { status: 400 });
  }

  const expedientes = await prisma.expediente.findMany({
    where: { clienteId },
    include: { _count: { select: { gold: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(expedientes);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    clienteId: string;
    nombre: string;
    codigo?: string;
    descripcion?: string;
    abogado?: string;
    radicado?: string;
    estado?: string;
  };

  if (!body.clienteId || !body.nombre?.trim()) {
    return NextResponse.json({ error: 'clienteId y nombre requeridos' }, { status: 400 });
  }

  const expediente = await prisma.expediente.create({
    data: {
      clienteId: body.clienteId,
      nombre: body.nombre.trim(),
      codigo: body.codigo?.trim() || null,
      descripcion: body.descripcion?.trim() || null,
      abogado: body.abogado?.trim() || null,
      radicado: body.radicado?.trim() || null,
      estado: body.estado ?? 'ACTIVO',
    },
  });

  return NextResponse.json(expediente, { status: 201 });
}
