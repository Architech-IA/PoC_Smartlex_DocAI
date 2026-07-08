const NOTION_TOKEN = process.env.NOTION_TOKEN ?? '';
const NOTION_API = 'https://api.notionhq.com/v1';

interface NotionPage {
  id: string;
  url: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}

interface NotionSearchResult {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

function notionHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

function extraerTextoBloque(bloque: NotionBlock): string {
  const tipo = bloque.type as string;
  const contenido = bloque[tipo] as { rich_text?: Array<{ plain_text: string }> } | undefined;
  if (!contenido || !Array.isArray(contenido.rich_text)) return '';
  return contenido.rich_text.map((t) => t.plain_text).join('');
}

function extraerTitulo(page: NotionPage): string {
  for (const prop of Object.values(page.properties)) {
    const p = prop as { type?: string; title?: Array<{ plain_text: string }> };
    if (p.type === 'title' && Array.isArray(p.title)) {
      return p.title.map((t) => t.plain_text).join('');
    }
  }
  return page.id;
}

async function obtenerBloques(pageId: string): Promise<string> {
  if (!NOTION_TOKEN) return '';

  let texto = '';
  let cursor: string | null = null;

  do {
    const url = cursor
      ? `${NOTION_API}/blocks/${pageId}/children?page_size=100&start_cursor=${cursor}`
      : `${NOTION_API}/blocks/${pageId}/children?page_size=100`;

    const res = await fetch(url, { headers: notionHeaders() });
    if (!res.ok) break;

    const data = (await res.json()) as { results: NotionBlock[]; next_cursor: string | null };
    for (const bloque of data.results) {
      const linea = extraerTextoBloque(bloque);
      if (linea) texto += linea + '\n';
    }
    cursor = data.next_cursor;
  } while (cursor);

  return texto;
}

export interface PaginaNotion {
  id: string;
  titulo: string;
  url: string;
  ultimaEdicion: Date;
  contenido: string;
}

export async function getPaginasModificadas(desde: Date): Promise<PaginaNotion[]> {
  if (!NOTION_TOKEN) {
    console.warn('[notion] NOTION_TOKEN no configurado, omitiendo sincronización');
    return [];
  }

  const paginas: PaginaNotion[] = [];
  let cursor: string | null = null;

  do {
    const body: Record<string, unknown> = {
      filter: {
        value: 'page',
        property: 'object',
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_API}/search`, {
      method: 'POST',
      headers: notionHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[notion] Error en search:', await res.text());
      break;
    }

    const data = (await res.json()) as NotionSearchResult;

    for (const page of data.results) {
      const ultimaEdicion = new Date(page.last_edited_time);
      if (ultimaEdicion <= desde) break;

      const titulo = extraerTitulo(page);
      const contenido = await obtenerBloques(page.id);

      paginas.push({ id: page.id, titulo, url: page.url, ultimaEdicion, contenido });
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return paginas;
}
