import { Logger } from '@nestjs/common';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';
import {
  ImageStorageService,
  MAX_IMAGE_BYTES,
} from 'src/shared/files/image-storage.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

function messages(action: () => unknown): Record<string, string[]> {
  try {
    action();
  } catch (error) {
    return (
      (error as FieldValidationException).getResponse() as {
        errors: Record<string, string[]>;
      }
    ).errors;
  }
  throw new Error('não lançou');
}

describe('ImageStorageService', () => {
  const original = { ...process.env };
  let dir: string;
  let service: ImageStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nivela-img-'));
    process.env.UPLOADS_DIR = dir;
    service = new ImageStorageService();
  });

  afterEach(async () => {
    process.env = { ...original };
    await rm(dir, { recursive: true, force: true });
  });

  it('valida: PNG passa; vazio, texto e acima de 2 MB são recusados', () => {
    expect(service.validate({ buffer: PNG })).toBe('png');
    expect(messages(() => service.validate(undefined))).toEqual({
      image: ['Envie uma imagem.'],
    });
    expect(
      messages(() => service.validate({ buffer: Buffer.from('texto') })),
    ).toEqual({ image: ['Envie uma imagem JPG, PNG ou WEBP.'] });
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(messages(() => service.validate({ buffer: big }))).toEqual({
      image: ['A imagem deve ter no máximo 2 MB.'],
    });
  });

  it('grava em <pasta>/<prefixo>-<uuid>.<ext> pela assinatura dos bytes e remove', async () => {
    const relative = await service.save('rewards', PNG, '7');
    expect(relative).toMatch(/^rewards\/7-[0-9a-f-]{36}\.png$/);
    expect(await readFile(join(dir, relative))).toEqual(PNG);

    await service.remove(relative);
    expect(await readdir(join(dir, 'rewards'))).toEqual([]);
    await service.remove(relative);
    await service.remove(null);
  });

  it('sem prefixo, o nome é só o uuid', async () => {
    expect(await service.save('rewards', PNG)).toMatch(
      /^rewards\/[0-9a-f-]{36}\.png$/,
    );
  });

  it('save recusa bytes que não são imagem', async () => {
    await expect(
      service.save('rewards', Buffer.from('texto')),
    ).rejects.toBeInstanceOf(FieldValidationException);
  });

  it('não apaga fora da pasta de uploads', async () => {
    const uploadsRoot = join(dir, 'uploads');
    await mkdir(uploadsRoot);
    process.env.UPLOADS_DIR = uploadsRoot;
    const sentinel = join(dir, 'sentinela.png');
    await writeFile(sentinel, PNG);

    await service.remove('../sentinela.png');
    await service.remove(sentinel);

    expect(await readFile(sentinel)).toEqual(PNG);
  });

  it('não falha se apagar o arquivo der erro (só registra aviso)', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await mkdir(join(dir, 'rewards', 'pasta'), { recursive: true });
    await expect(service.remove('rewards/pasta')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('monta o caminho relativo à raiz (sem host)', () => {
    expect(service.urlFor('rewards/1-a.png')).toBe('/uploads/rewards/1-a.png');
    expect(service.urlFor(null)).toBeNull();
  });
});
