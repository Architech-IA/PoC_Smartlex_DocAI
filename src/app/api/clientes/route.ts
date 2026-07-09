import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const clientes = await prisma.cliente.findMany({ orderBy: { nombre: 'asc' } });
  return NextResponse.json(clientes);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { nombre: string; nit?: string; tipo?: string; contacto?: string; notas?: string };
  if (!body.nombre?.trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
  try {
    const cliente = await prisma.cliente.create({
      data: {
        nombre: body.nombre.trim(),
        nit: body.nit?.trim() || null,
        tipo: body.tipo ?? 'EMPRESA',
        contacto: body.contacto?.trim() || null,
        notas: body.notas?.trim() || null,
      },
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'NIT ya existe' }, { status: 409 });
  }
}
