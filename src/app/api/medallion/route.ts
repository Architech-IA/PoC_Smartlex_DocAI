import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [bronzeStats, silverStats, goldStats, porSocio, pendientesGold] = await Promise.all([
    // Bronze: conteo por estado
    prisma.docBronze.groupBy({ by: ['estado'], _count: { id: true } }),
    // Silver: conteo por estado
    prisma.documento.groupBy({ by: ['estado'], _count: { id: true } }),
    // Gold: total asignados
    prisma.docGold.count(),
    // Por socio: cuántos docs subió cada quien
    prisma.documento.groupBy({ by: ['socio'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    // Pendientes de asignación gold
    prisma.documento.count({ where: { estado: 'LISTO', gold: null } }),
  ]);

  const bronzeTotal = bronzeStats.reduce((s, r) => s + r._count.id, 0);
  const silverListo = silverStats.find(r => r.estado === 'LISTO')?._count.id ?? 0;
  const silverTotal = silverStats.reduce((s, r) => s + r._count.id, 0);

  return NextResponse.json({
    bronze: {
      total: bronzeTotal,
      porEstado: Object.fromEntries(bronzeStats.map(r => [r.estado, r._count.id])),
    },
    silver: {
      total: silverTotal,
      porEstado: Object.fromEntries(silverStats.map(r => [r.estado, r._count.id])),
    },
    gold: {
      total: goldStats,
      pendientes: pendientesGold,
    },
    porSocio: porSocio.map(r => ({ socio: r.socio ?? 'Sin carpeta', total: r._count.id })),
  });
}
