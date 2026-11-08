import { resolve } from 'node:path';

/** Pasta onde os arquivos enviados são gravados (`UPLOADS_DIR`, padrão `uploads`). */
export function uploadsDir(): string {
  return resolve(process.env.UPLOADS_DIR?.trim() || 'uploads');
}

/** Prefixo (relativo à raiz do servidor) em que a pasta de uploads é servida. */
export const UPLOADS_PREFIX = '/uploads';
