const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3-embedding:0.6b';

export async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama embeddings error: ${res.status}`);
  const data = await res.json() as { embedding: number[] };
  return data.embedding;
}

export function vectorToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
