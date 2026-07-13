import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const expediente = await prisma.expediente.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true, nit: true } },
      gold: {
        include: {
          documento: {
            select: {
              id: true, nombre: true, tipo: true, area: true,
              estado: true, resumen: true, tamanoBytes: true,
              createdAt: true, updatedAt: true,
            },
          },
        },
        orderBy: { asignadoEn: 'desc' },
      },
    },
  })

  if (!expediente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(expediente)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json() as {
    nombre?: string
    descripcion?: string
    estado?: string
    abogado?: string
    radicado?: string
    fechaInicio?: string | null
    fechaCierre?: string | null
    fechaLimite?: string | null
    partes?: {
      demandante?: string
      demandado?: string
      apoderado?: string
      contraparte?: string
    } | null
  }

  const expediente = await prisma.expediente.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
      ...(body.estado !== undefined && { estado: body.estado }),
      ...(body.abogado !== undefined && { abogado: body.abogado }),
      ...(body.radicado !== undefined && { radicado: body.radicado }),
      ...(body.fechaInicio !== undefined && { fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null }),
      ...(body.fechaCierre !== undefined && { fechaCierre: body.fechaCierre ? new Date(body.fechaCierre) : null }),
      ...(body.fechaLimite !== undefined && { fechaLimite: body.fechaLimite ? new Date(body.fechaLimite) : null }),
      ...(body.partes !== undefined && { partes: body.partes ?? undefined }),
    },
    include: {
      cliente: { select: { id: true, nombre: true, nit: true } },
      _count: { select: { gold: true } },
    },
  })

  return NextResponse.json(expediente)
}
