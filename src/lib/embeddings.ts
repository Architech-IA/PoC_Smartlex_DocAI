const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen3-embedding:0.6b';

interface OllamaEmbeddingResponse {
  embedding: number[];
}

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as OllamaEmbeddingResponse;
  return data.embedding;
}

/** Convierte un array de números al string que pgvector espera: '[0.1,0.2,...]' */
export function vectorToSql(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
