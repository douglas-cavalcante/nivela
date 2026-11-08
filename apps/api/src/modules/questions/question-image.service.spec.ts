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
import {
  MAX_IMAGE_BYTES,
  QuestionImageService,
} from 'src/modules/questions/question-image.service';
import { FieldValidationException } from 'src/shared/exceptions/field-validation.exception';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

function file(buffer: Buffer) {
  return { buffer };
}

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

describe('QuestionImageService', () => {
  const original = { ...process.env };
  let dir: string;
  let service: QuestionImageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nivela-img-'));
    process.env.UPLOADS_DIR = dir;
    process.env.PUBLIC_URL = 'https://api.nivela.test';
    service = new QuestionImageService();
  });

  afterEach(async () => {
    process.env = { ...original };
    await rm(dir, { recursive: true, force: true });
  });

  describe('validate', () => {
    it('aceita PNG e devolve o tipo', () => {
      expect(service.validate(file(PNG))).toBe('png');
    });

    it('sem arquivo ou arquivo vazio → "Envie uma imagem."', () => {
      expect(messages(() => service.validate(undefined))).toEqual({
        image: ['Envie uma imagem.'],
      });
      expect(messages(() => service.validate(file(Buffer.alloc(0))))).toEqual({
        image: ['Envie uma imagem.'],
      });
    });

    it('texto fingindo ser imagem → tipo inválido', () => {
      expect(
        messages(() => service.validate(file(Buffer.from('não sou imagem')))),
      ).toEqual({ image: ['Envie uma imagem JPG, PNG ou WEBP.'] });
    });

    it('acima de 2 MB → tamanho', () => {
      const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
      expect(messages(() => service.validate(file(big)))).toEqual({
        image: ['A imagem deve ter no máximo 2 MB.'],
      });
    });

    it('exatamente 2 MB passa', () => {
      const exact = Buffer.concat([
        PNG,
        Buffer.alloc(MAX_IMAGE_BYTES - PNG.length),
      ]);
      expect(service.validate(file(exact))).toBe('png');
    });
  });

  it('grava em questions/<id>-<uuid>.<ext> e remove o arquivo', async () => {
    const relative = await service.save(7, PNG, 'png');
    expect(relative).toMatch(/^questions\/7-[0-9a-f-]{36}\.png$/);
    expect(await readFile(join(dir, relative))).toEqual(PNG);

    await service.remove(relative);
    expect(await readdir(join(dir, 'questions'))).toEqual([]);
    // Apagar de novo (ou sem caminho) não falha.
    await service.remove(relative);
    await service.remove(null);
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
    // Um diretório não vazio faz o rm (sem recursive) falhar com EISDIR/ENOTEMPTY.
    await mkdir(join(dir, 'questions', 'pasta'), { recursive: true });
    await expect(service.remove('questions/pasta')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('monta a URL pública', () => {
    expect(service.urlFor('questions/1-a.png')).toBe(
      'https://api.nivela.test/uploads/questions/1-a.png',
    );
    expect(service.urlFor(null)).toBeNull();
  });
});
