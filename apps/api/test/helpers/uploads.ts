import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Cria uma pasta temporária de uploads para a suíte e aponta `UPLOADS_DIR` e
 * `PUBLIC_URL` para ela. Chamar em beforeAll, antes de `createTestApp`.
 */
export async function createUploadsDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'nivela-uploads-'));
  process.env.UPLOADS_DIR = dir;
  process.env.PUBLIC_URL = 'http://api.nivela.test';
  return dir;
}

/** Remove a pasta temporária (afterAll). */
export async function removeUploadsDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/** Arquivos gravados em `<uploads>/questions` (vazio se a pasta nem existe). */
export async function listQuestionFiles(dir: string): Promise<string[]> {
  try {
    return await readdir(join(dir, 'questions'));
  } catch {
    return [];
  }
}
