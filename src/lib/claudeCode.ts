import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function runSkill(skill: string, input: string): Promise<string> {
  const inputPath = join(tmpdir(), `skill-input-${randomUUID()}.txt`);
  await writeFile(inputPath, input, 'utf8');
  try {
    return await new Promise((resolve, reject) => {
      execFile(
        'claude',
        ['-p', `/${skill}`, '--input', inputPath, '--output-format', 'text'],
        { timeout: 120_000 },
        (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout.trim());
        },
      );
    });
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}
