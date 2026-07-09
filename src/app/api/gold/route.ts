import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logEvento } from '@/lib/auditoria';

const GOLD_BASE = process.env.VAULT_CLIENTES_PATH ?? '/app/gold/clientes';

function slugify(text: string) {
  return text.replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get('clienteId');
  const pendientes = searchParams.get('pendientes') === '1';
  const documentoId = searchParams.get('documentoId');

  if (documentoId) {
    const gold = await prisma.docGold.findUnique({
      where: { documentoId },
      include: {
        cliente: { select: { nombre: true } },
        expediente: { select: { id: true, nombre: true, codigo: true, estado: true } },
      },
    });
    return NextResponse.json(gold ? [gold] : []);
  }

  if (pendientes) {
    const docs = await prisma.documento.findMany({
      where: { estado: 'LISTO', gold: null },
      select: { id: true, nombre: true, tipo: true, area: true, resumen: true, socio: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(docs);
  }

  const gold = await prisma.docGold.findMany({
    where: clienteId ? { clienteId } : {},
    include: {
      documento: { select: { nombre: true, tipo: true, area: true, estado: true } },
      cliente: { select: { nombre: true } },
      expediente: { select: { nombre: true, codigo: true } },
    },
    orderBy: { asignadoEn: 'desc' },
  });
  return NextResponse.json(gold);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    documentoId: string;
    clienteId: string;
    expedienteId?: string;
    asignadoPor?: string;
    notas?: string;
  };

  if (!body.documentoId || !body.clienteId) {
    return NextResponse.json({ error: 'documentoId y clienteId requeridos' }, { status: 400 });
  }

  const [doc, cliente] = await Promise.all([
    prisma.documento.findUnique({
      where: { id: body.documentoId },
      select: { id: true, nombre: true, origenCarpeta: true },
    }),
    prisma.cliente.findUnique({ where: { id: body.clienteId }, select: { id: true, nombre: true } }),
  ]);

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  // Resolver expediente si viene
  let expediente = null;
  if (body.expedienteId) {
    expediente = await prisma.expediente.findUnique({
      where: { id: body.expedienteId },
      select: { id: true, nombre: true, codigo: true },
    });
  }

  // Construir ruta física: GOLD/clientes/{Cliente}/{Expediente}/
  const clienteSlug = slugify(cliente.nombre);
  let rutaDestino = join(GOLD_BASE, clienteSlug);
  if (expediente) {
    const expSlug = slugify(expediente.codigo ?? expediente.nombre);
    rutaDestino = join(GOLD_BASE, clienteSlug, expSlug);
  }

  try { await mkdir(rutaDestino, { recursive: true }); } catch { /* ya existe */ }

  // Copiar archivo Silver → Gold
  if (doc.origenCarpeta) {
    const srcPath = join(doc.origenCarpeta, doc.nombre);
    const destPath = join(rutaDestino, doc.nombre);
    try { await copyFile(srcPath, destPath); } catch (e) { console.warn('[gold] copyFile falló:', e); }
  }

  const gold = await prisma.docGold.upsert({
    where: { documentoId: body.documentoId },
    update: {
      clienteId: body.clienteId,
      expedienteId: body.expedienteId ?? null,
      rutaCliente: rutaDestino,
      asignadoPor: body.asignadoPor ?? 'sistema',
      notas: body.notas ?? null,
    },
    create: {
      documentoId: body.documentoId,
      clienteId: body.clienteId,
      expedienteId: body.expedienteId ?? null,
      rutaCliente: rutaDestino,
      asignadoPor: body.asignadoPor ?? 'sistema',
      notas: body.notas ?? null,
    },
    include: {
      cliente: { select: { nombre: true } },
      expediente: { select: { id: true, nombre: true, codigo: true, estado: true } },
    },
  });

  const destLabel = expediente ? `expediente "${expediente.nombre}" de "${cliente.nombre}"` : `cliente "${cliente.nombre}"`;
  await logEvento({
    entidad: 'DOCUMENTO',
    entidadId: body.documentoId,
    accion: 'ASIGNAR_CLIENTE',
    actor: body.asignadoPor ?? 'sistema',
    detalle: `Asignado a ${destLabel}`,
  });

  return NextResponse.json(gold, { status: 201 });
}
