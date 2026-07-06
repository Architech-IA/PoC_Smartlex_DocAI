import { execFile } from 'node:child_process';

// Cola secuencial — un solo Skill a la vez porque la cuenta de servicio es compartida.
let colaActiva: Promise<unknown> = Promise.resolve();

export async function runSkill(skill: string, input: string): Promise<string> {
  // El CLI de Claude Code recibe el prompt como argumento de -p.
  // Formato: "/<skill>\n\n<input>" — la primera línea activa la Skill, el resto es el input.
  const prompt = `/${skill}\n\n${input}`;

  const tarea = colaActiva.then(
    () =>
      new Promise<string>((resolve, reject) => {
        execFile(
          'claude',
          ['-p', prompt, '--output-format', 'text', '--dangerously-skip-permissions'],
          { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
          },
        );
      }),
  );

  colaActiva = tarea.catch(() => {});
  return tarea;
}
