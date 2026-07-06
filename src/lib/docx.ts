import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';

export interface ActaData {
  titulo: string;
  fecha: string;
  duracion?: string;
  participantes: { nombre: string; rol?: string }[];
  puntosTratados: string[];
  acuerdos: string[];
  proximosPasos: string[];
  resumen: string;
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    text: `• ${text}`,
    indent: { left: 360 },
    spacing: { after: 80 },
  });
}

function seccion(titulo: string): Paragraph {
  return new Paragraph({
    text: titulo,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '2563EB' } },
  });
}

export async function generarDocx(acta: ActaData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Encabezado
  children.push(
    new Paragraph({
      text: 'ACTA DE REUNIÓN',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: acta.titulo, bold: true, size: 26 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Fecha: `, bold: true }),
        new TextRun({ text: acta.fecha }),
        ...(acta.duracion
          ? [new TextRun({ text: `     Duración: `, bold: true }), new TextRun({ text: acta.duracion })]
          : []),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  );

  // Resumen
  children.push(
    seccion('Resumen'),
    new Paragraph({ text: acta.resumen, spacing: { after: 200 } }),
  );

  // Participantes
  if (acta.participantes.length > 0) {
    children.push(seccion('Participantes'));
    const rows = acta.participantes.map(
      (p) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(p.nombre)], width: { size: 50, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph(p.rol ?? '')], width: { size: 50, type: WidthType.PERCENTAGE } }),
          ],
        }),
    );
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Nombre', bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Rol / Cargo', bold: true })] })], width: { size: 50, type: WidthType.PERCENTAGE } }),
            ],
            tableHeader: true,
          }),
          ...rows,
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
  }

  // Puntos tratados
  if (acta.puntosTratados.length > 0) {
    children.push(seccion('Puntos Tratados'));
    acta.puntosTratados.forEach((p, i) =>
      children.push(bullet(`${i + 1}. ${p}`)),
    );
  }

  // Acuerdos
  if (acta.acuerdos.length > 0) {
    children.push(seccion('Acuerdos y Decisiones'));
    acta.acuerdos.forEach((a) => children.push(bullet(a)));
  }

  // Próximos pasos
  if (acta.proximosPasos.length > 0) {
    children.push(seccion('Próximos Pasos'));
    acta.proximosPasos.forEach((p) => children.push(bullet(p)));
  }

  // Pie
  children.push(
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Documento generado automáticamente por Smartlex DocAI', italics: true, color: '6B7280', size: 18 })],
      alignment: AlignmentType.CENTER,
    }),
  );

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
