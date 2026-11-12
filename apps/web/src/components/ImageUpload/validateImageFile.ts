export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_WRONG_TYPE = 'Envie uma imagem JPG, PNG ou WEBP.';
export const IMAGE_TOO_BIG = 'A imagem deve ter no máximo 2 MB.';
const ALLOWED_IMAGE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;

/**
 * Checagem rápida no cliente (extensão e tipo MIME; a API confere a assinatura dos bytes de verdade).
 * Devolve a mensagem de erro, a mesma da API, ou `null` se o arquivo pode ser enviado.
 */
export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  const typeOk = file.type === '' || ALLOWED_IMAGE_TYPES.includes(file.type);
  if (!typeOk || !ALLOWED_IMAGE_EXTENSION.test(file.name)) return IMAGE_WRONG_TYPE;
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_TOO_BIG;
  return null;
}
