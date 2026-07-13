import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { execSync } from 'child_process'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const expediente = await prisma.expediente.findUnique({
    where: { id },
    include: {
      cliente: { select: { nombre: true } },
      gold: {
        include: {
          documento: {
            select: { nombre: true, tipo: true, area: true, resumen: true, datosClave: true, textoExtraido: true },
          },
        },
      },
    },
  })

  if (!expediente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (expediente.gold.length === 0) {
    return NextResponse.json({ error: 'El expediente no tiene documentos asignados' }, { status: 400 })
  }

  // Construir contexto para el LLM
  const docsTexto = expediente.gold.map((g, i) => {
    const doc = g.documento
    let datosStr = ''
    try { datosStr = doc.datosClave ? JSON.stringify(JSON.parse(doc.datosClave), null, 2) : '' } catch { /* ok */ }
    return [
      `--- DOCUMENTO ${i + 1}: ${doc.nombre} [${doc.tipo}${doc.area ? ' / ' + doc.area : ''}] ---`,
      doc.resumen ? `Resumen: ${doc.resumen}` : '',
      datosStr ? `Datos clave:\n${datosStr}` : '',
      doc.textoExtraido ? `Texto (primeros 1500 chars):\n${doc.textoExtraido.slice(0, 1500)}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const prompt = `Sos un asistente jurídico especializado. Analizá el siguiente expediente legal y sus documentos.

EXPEDIENTE: ${expediente.nombre}
CLIENTE: ${expediente.cliente.nombre}
${expediente.radicado ? `RADICADO: ${expediente.radicado}` : ''}
${expediente.estado ? `ESTADO: ${expediente.estado}` : ''}
DOCUMENTOS TOTALES: ${expediente.gold.length}

${docsTexto}

Respondé EXCLUSIVAMENTE con un JSON válido (sin texto adicional, sin markdown) con esta estructura exacta:
{
  "resumenEjecutivo": "Resumen ejecutivo del caso en 3-5 oraciones.",
  "documentosFaltantes": ["lista", "de", "documentos", "que", "faltan", "para", "este", "tipo", "de", "caso"],
  "alertas": ["alerta 1 si existe", "alerta 2 si existe"],
  "estadoLegal": "evaluación breve del estado actual del caso"
}`

  let resumenIA = null
  let documentosFaltantes: string[] = []

  try {
    const escaped = prompt.replace(/'/g, "'\\''")
    const raw = execSync(`claude -p '${escaped}' 2>/dev/null`, {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    }).toString().trim()

    // Extraer JSON
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as {
        resumenEjecutivo?: string
        documentosFaltantes?: string[]
        alertas?: string[]
        estadoLegal?: string
      }
      resumenIA = [
        parsed.resumenEjecutivo,
        parsed.estadoLegal ? `\n\nEstado legal: ${parsed.estadoLegal}` : '',
        parsed.alertas?.length ? `\n\nAlertas: ${parsed.alertas.join('; ')}` : '',
      ].filter(Boolean).join('')
      documentosFaltantes = parsed.documentosFaltantes ?? []
    } else {
      resumenIA = raw.slice(0, 2000)
    }
  } catch (e) {
    return NextResponse.json({ error: 'Error al generar análisis IA', detalle: String(e) }, { status: 500 })
  }

  const updated = await prisma.expediente.update({
    where: { id },
    data: {
      resumenIA,
      documentosFaltantes,
      ultimoAnalisis: new Date(),
    },
  })

  return NextResponse.json({
    resumenIA: updated.resumenIA,
    documentosFaltantes: updated.documentosFaltantes,
    ultimoAnalisis: updated.ultimoAnalisis,
  })
}
