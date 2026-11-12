import { resolve } from 'node:path';
import { uploadsDir } from 'src/shared/files/uploads-config';

describe('uploads-config', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa o padrão sem a variável', () => {
    delete process.env.UPLOADS_DIR;
    expect(uploadsDir()).toBe(resolve('uploads'));
  });

  it('lê UPLOADS_DIR', () => {
    process.env.UPLOADS_DIR = 'tmp-arquivos';
    expect(uploadsDir()).toBe(resolve('tmp-arquivos'));
  });
});
