import { INestApplication } from '@nestjs/common';
import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createCategory, createQuestion } from './helpers/factories';
import { JPEG_BYTES, padTo, PNG_BYTES, WEBP_BYTES } from './helpers/images';
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';
import {
  createUploadsDir,
  listQuestionFiles,
  removeUploadsDir,
} from './helpers/uploads';

const MB = 1024 * 1024;

describe('Imagem das questões (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploads: string;
  let teacher: string;
  let questionId: number;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const upload = (
    token: string,
    body: Buffer,
    filename = 'foto.png',
    id = questionId,
  ) =>
    http()
      .post(`/api/v1/questions/${id}/image`)
      .set(as(token))
      .attach('image', body, filename);
  const exists = (path: string) =>
    access(path).then(
      () => true,
      () => false,
    );

  beforeAll(async () => {
    uploads = await createUploadsDir();
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    teacher = await tokenFor(app, Role.Teacher);
    const me = await prisma.user.findFirstOrThrow({
      where: { role: Role.Teacher },
    });
    const category = await createCategory(prisma);
    const question = await createQuestion(prisma, {
      authorId: me.id,
      subjectId: category.subjectId,
      categoryId: category.id,
    });
    questionId = question.id;
    // Esvazia a pasta entre os testes.
    await removeUploadsDir(join(uploads, 'questions'));
  });

  afterAll(async () => {
    await app.close();
    await removeUploadsDir(uploads);
  });

  it('sobe um PNG real e a URL devolvida serve o arquivo', async () => {
    const res = await upload(teacher, PNG_BYTES).expect(200);
    expect(res.body.image_url).toMatch(
      new RegExp(
        `^http://api\\.nivela\\.test/uploads/questions/${questionId}-[0-9a-f-]{36}\\.png$`,
      ),
    );

    const path = new URL(res.body.image_url as string).pathname;
    const served = await http().get(path).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(served.body as Buffer)).toEqual(PNG_BYTES);

    const question = await http()
      .get(`/api/v1/questions/${questionId}`)
      .set(as(teacher))
      .expect(200);
    expect(question.body.image_url).toBe(res.body.image_url);
    const list = await http()
      .get('/api/v1/questions')
      .set(as(teacher))
      .expect(200);
    expect(list.body.data[0].has_image).toBe(true);
  });

  it.each([
    ['JPEG', JPEG_BYTES, 'jpg', 'image/jpeg'],
    ['WEBP', WEBP_BYTES, 'webp', 'image/webp'],
  ])('aceita %s', async (_name, bytes, ext, mime) => {
    // O nome do arquivo não importa: vale a assinatura dos bytes.
    const res = await upload(teacher, bytes, 'qualquer-nome.bin').expect(200);
    expect(res.body.image_url).toMatch(new RegExp(`\\.${ext}$`));
    const served = await http()
      .get(new URL(res.body.image_url as string).pathname)
      .expect(200);
    expect(served.headers['content-type']).toBe(mime);
  });

  it('.png com conteúdo de texto → 422 e nada em disco', async () => {
    const res = await upload(
      teacher,
      Buffer.from('isto é só um texto, não uma imagem'),
      'falsa.png',
    ).expect(422);
    expect(res.body.errors.image).toEqual([
      'Envie uma imagem JPG, PNG ou WEBP.',
    ]);
    expect(await listQuestionFiles(uploads)).toEqual([]);
    const stored = await prisma.question.findUniqueOrThrow({
      where: { id: questionId },
    });
    expect(stored.imagePath).toBeNull();
  });

  it('imagem de 3 MB → 422 e nada em disco', async () => {
    const res = await upload(teacher, padTo(PNG_BYTES, 3 * MB)).expect(422);
    expect(res.body.errors.image).toEqual([
      'A imagem deve ter no máximo 2 MB.',
    ]);
    expect(await listQuestionFiles(uploads)).toEqual([]);
  });

  it('acima do limite duro de 5 MB → 413 e nada em disco', async () => {
    const res = await upload(teacher, padTo(PNG_BYTES, 6 * MB)).expect(413);
    expect(res.body).toEqual({ message: 'Arquivo muito grande.' });
    expect(await listQuestionFiles(uploads)).toEqual([]);
  });

  it('sem arquivo → 422 "Envie uma imagem."', async () => {
    const res = await http()
      .post(`/api/v1/questions/${questionId}/image`)
      .set(as(teacher))
      .field('legenda', 'sem arquivo')
      .expect(422);
    expect(res.body.errors.image).toEqual(['Envie uma imagem.']);
    const json = await http()
      .post(`/api/v1/questions/${questionId}/image`)
      .set(as(teacher))
      .send({})
      .expect(422);
    expect(json.body.errors.image).toEqual(['Envie uma imagem.']);
  });

  it('trocar a imagem apaga a anterior', async () => {
    const first = await upload(teacher, PNG_BYTES).expect(200);
    const firstFile = new URL(first.body.image_url as string).pathname.replace(
      '/uploads/',
      '',
    );
    expect(await exists(join(uploads, firstFile))).toBe(true);

    const second = await upload(teacher, JPEG_BYTES, 'nova.jpg').expect(200);
    expect(second.body.image_url).not.toBe(first.body.image_url);
    expect(await exists(join(uploads, firstFile))).toBe(false);
    expect(await listQuestionFiles(uploads)).toHaveLength(1);
    await http()
      .get(new URL(first.body.image_url as string).pathname)
      .expect(404);
  });

  it('DELETE apaga o arquivo e limpa a questão', async () => {
    const res = await upload(teacher, PNG_BYTES).expect(200);
    expect(await listQuestionFiles(uploads)).toHaveLength(1);

    await http()
      .delete(`/api/v1/questions/${questionId}/image`)
      .set(as(teacher))
      .expect(204);
    expect(await listQuestionFiles(uploads)).toEqual([]);
    await http()
      .get(new URL(res.body.image_url as string).pathname)
      .expect(404);
    const question = await http()
      .get(`/api/v1/questions/${questionId}`)
      .set(as(teacher))
      .expect(200);
    expect(question.body.image_url).toBeNull();
  });

  it('DELETE sem imagem é idempotente (204)', async () => {
    await http()
      .delete(`/api/v1/questions/${questionId}/image`)
      .set(as(teacher))
      .expect(204);
  });

  it('outro professor → 403 (upload e remoção) e nada é gravado', async () => {
    const other = await tokenFor(app, Role.Teacher);
    const res = await upload(other, PNG_BYTES).expect(403);
    expect(res.body).toEqual({
      message: 'Só o autor ou um administrador pode editar esta questão.',
    });
    expect(await listQuestionFiles(uploads)).toEqual([]);

    await upload(teacher, PNG_BYTES).expect(200);
    await http()
      .delete(`/api/v1/questions/${questionId}/image`)
      .set(as(other))
      .expect(403);
    expect(await listQuestionFiles(uploads)).toHaveLength(1);
  });

  it('administrador pode trocar a imagem de outro autor', async () => {
    const admin = await tokenFor(app, Role.Admin);
    await upload(admin, WEBP_BYTES, 'a.webp').expect(200);
    expect(await listQuestionFiles(uploads)).toHaveLength(1);
  });

  it('questão inexistente → 404 e aluno → 403', async () => {
    const res = await upload(teacher, PNG_BYTES, 'a.png', 999).expect(404);
    expect(res.body).toEqual({ message: 'Questão não encontrada.' });
    const student = await tokenFor(app, Role.Student);
    await upload(student, PNG_BYTES).expect(403);
    await http()
      .delete(`/api/v1/questions/${questionId}/image`)
      .set(as(student))
      .expect(403);
    expect(await listQuestionFiles(uploads)).toEqual([]);
  });

  it('sem token → 401', async () => {
    await http()
      .post(`/api/v1/questions/${questionId}/image`)
      .attach('image', PNG_BYTES, 'a.png')
      .expect(401);
  });

  it('não lista diretórios nem serve dotfiles em /uploads', async () => {
    await upload(teacher, PNG_BYTES).expect(200);
    await writeFile(join(uploads, 'questions', '.segredo'), 'x');

    await http().get('/uploads/questions').expect(404);
    await http().get('/uploads/questions/').expect(404);
    const dot = await http().get('/uploads/questions/.segredo');
    expect([403, 404]).toContain(dot.status);
  });
});
