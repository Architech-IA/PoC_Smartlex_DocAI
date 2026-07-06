import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Ruta al directorio de Skills, relativa al proyecto
const SKILLS_DIR = join(process.cwd(), 'skills');

// Cola secuencial — un solo Skill a la vez porque la cuenta de servicio es compartida.
let colaActiva: Promise<unknown> = Promise.resolve();

export async function runSkill(skill: string, input: string): Promise<string> {
  // Leer el contenido del archivo de instrucción de la Skill
  let instruccion: string;
  try {
    instruccion = await readFile(join(SKILLS_DIR, `${skill}.md`), 'utf8');
  } catch {
    throw new Error(`Skill no encontrada: ${skill}.md en ${SKILLS_DIR}`);
  }

  // El sistema prompt lleva la instrucción de la Skill; el prompt del usuario lleva el input
  const tarea = colaActiva.then(
    () =>
      new Promise<string>((resolve, reject) => {
        const proc = execFile(
          'claude',
          [
            '-p', input,
            '--system-prompt', instruccion,
            '--output-format', 'text',
          ],
          { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
          (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
          },
        );
        proc.stdin?.end();
      }),
  );

  colaActiva = tarea.catch(() => {});
  return tarea;
}
