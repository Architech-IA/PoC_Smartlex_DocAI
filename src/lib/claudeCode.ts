import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Cola secuencial — un solo Skill a la vez porque la cuenta de servicio es compartida.
let colaActiva: Promise<unknown> = Promise.resolve();

export async function runSkill(skill: string, input: string): Promise<string> {
  const inputPath = join(tmpdir(), `skill-${randomUUID()}.txt`);
  await writeFile(inputPath, input, 'utf8');

  const tarea = colaActiva.then(
    () =>
      new Promise<string>((resolve, reject) => {
        execFile(
          'claude',
          ['-p', `/${skill}`, '--input-file', inputPath, '--output-format', 'text'],
          { timeout: 120_000 },
          (err, stdout, stderr) => {
            unlink(inputPath).catch(() => {});
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
          },
        );
      }),
  );

  // La cola espera que esta tarea termine (éxito o fallo) antes de la siguiente.
  colaActiva = tarea.catch(() => {});
  return tarea;
}
