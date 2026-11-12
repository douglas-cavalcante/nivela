import { isAllowedImage } from 'src/shared/files/image-signature';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('isAllowedImage', () => {
  it('reconhece PNG pela assinatura', () => {
    expect(isAllowedImage(Buffer.from([...PNG_HEADER, 0, 0, 0, 13]))).toBe(
      'png',
    );
  });

  it('reconhece JPEG pela assinatura', () => {
    expect(isAllowedImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]))).toBe(
      'jpg',
    );
  });

  it('reconhece WEBP (RIFF....WEBP)', () => {
    const buffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x1a, 0, 0, 0]),
      Buffer.from('WEBPVP8 '),
    ]);
    expect(isAllowedImage(buffer)).toBe('webp');
  });

  it('rejeita RIFF que não é WEBP (ex.: WAV)', () => {
    const buffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x1a, 0, 0, 0]),
      Buffer.from('WAVEfmt '),
    ]);
    expect(isAllowedImage(buffer)).toBeNull();
  });

  it('rejeita texto com extensão de imagem', () => {
    expect(isAllowedImage(Buffer.from('isto não é uma imagem'))).toBeNull();
  });

  it('rejeita GIF e PNG truncado', () => {
    expect(isAllowedImage(Buffer.from('GIF89a......'))).toBeNull();
    expect(isAllowedImage(Buffer.from(PNG_HEADER.slice(0, 5)))).toBeNull();
  });

  it('rejeita buffer vazio', () => {
    expect(isAllowedImage(Buffer.alloc(0))).toBeNull();
  });
});
