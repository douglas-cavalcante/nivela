import { resolve } from 'node:path';
import { publicUrl, uploadsDir } from 'src/shared/files/uploads-config';

describe('uploads-config', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa os padrões sem variáveis', () => {
    delete process.env.UPLOADS_DIR;
    delete process.env.PUBLIC_URL;
    expect(uploadsDir()).toBe(resolve('uploads'));
    expect(publicUrl()).toBe('http://localhost:8000');
  });

  it('lê as variáveis e tira a barra final da URL pública', () => {
    process.env.UPLOADS_DIR = 'tmp-arquivos';
    process.env.PUBLIC_URL = 'https://api.nivela.app//';
    expect(uploadsDir()).toBe(resolve('tmp-arquivos'));
    expect(publicUrl()).toBe('https://api.nivela.app');
  });
});
