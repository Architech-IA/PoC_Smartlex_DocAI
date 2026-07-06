import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await prisma.documento.findUnique({
    where: { id },
    select: { id: true, estado: true, tipo: true, area: true, resumen: true },
  });
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(doc);
}
