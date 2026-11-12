export type ImageKind = 'jpg' | 'png' | 'webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return (
    buffer.length >= offset + bytes.length &&
    bytes.every((byte, index) => buffer[offset + index] === byte)
  );
}

/**
 * Identifica JPG, PNG e WEBP pela assinatura dos primeiros bytes (a extensão
 * e o mimetype enviados pelo cliente não valem nada). Devolve `null` para
 * qualquer outra coisa.
 */
export function isAllowedImage(buffer: Buffer): ImageKind | null {
  if (startsWith(buffer, PNG)) {
    return 'png';
  }
  if (startsWith(buffer, JPEG)) {
    return 'jpg';
  }
  // WEBP: "RIFF" + tamanho (4 bytes) + "WEBP".
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
