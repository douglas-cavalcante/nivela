import { resolve } from 'node:path';

/** Pasta onde os arquivos enviados são gravados (`UPLOADS_DIR`, padrão `uploads`). */
export function uploadsDir(): string {
  return resolve(process.env.UPLOADS_DIR?.trim() || 'uploads');
}

/** Endereço público da API, base das URLs de arquivos (`PUBLIC_URL`). */
export function publicUrl(): string {
  const url = process.env.PUBLIC_URL?.trim() || 'http://localhost:8000';
  return url.replace(/\/+$/, '');
}

/** Prefixo em que a pasta de uploads é servida. */
export const UPLOADS_PREFIX = '/uploads';
