// Clasificador local en el host — el contenedor lo llama vía host-gateway
const CLASIFICADOR_URL = process.env.CLASIFICADOR_URL ?? 'http://host-gateway:3010';

// Cola secuencial — una petición a la vez
let colaActiva: Promise<unknown> = Promise.resolve();

export async function runSkill(skill: string, input: string): Promise<string> {
  const endpoint = skill === 'clasificar-documento' ? '/clasificar'
    : skill === 'generar-acta' ? '/generar-acta'
    : skill === 'responder-pregunta' ? '/responder-pregunta'
    : null;

  if (!endpoint) throw new Error(`Skill no soportada en clasificador local: ${skill}`);

  const tarea = colaActiva.then(async () => {
    let body: unknown;
    try { body = JSON.parse(input); } catch { body = input; }

    const res = await fetch(`${CLASIFICADOR_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
      throw new Error(err.error ?? res.statusText);
    }

    const data = await res.json() as { resultado: string };
    return data.resultado;
  });

  colaActiva = tarea.catch(() => {});
  return tarea as Promise<string>;
}
