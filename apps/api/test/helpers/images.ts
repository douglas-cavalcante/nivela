/** Imagens mínimas geradas em bytes, para os testes de upload (nenhum binário no repositório). */

// PNG 1x1 válido.
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// JPEG mínimo: SOI + APP0 (JFIF) + EOI.
export const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

// WEBP mínimo: cabeçalho RIFF + "WEBP" + chunk VP8 vazio.
export const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x16, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(10),
]);

/** Completa o buffer com zeros até `size` bytes. */
export function padTo(buffer: Buffer, size: number): Buffer {
  return Buffer.concat([
    buffer,
    Buffer.alloc(Math.max(0, size - buffer.length)),
  ]);
}
