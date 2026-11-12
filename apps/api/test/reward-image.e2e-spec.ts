import { INestApplication } from '@nestjs/common';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createReward } from './helpers/factories';
import { JPEG_BYTES, padTo, PNG_BYTES } from './helpers/images';
import { sessionFor, tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';
import { createUploadsDir, removeUploadsDir } from './helpers/uploads';

const MB = 1024 * 1024;

describe('Imagem dos prêmios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploads: string;
  let teacher: string;
  let rewardId: number;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const upload = (
    token: string,
    body: Buffer,
    filename = 'foto.png',
    id = rewardId,
  ) =>
    http()
      .post(`/api/v1/rewards/${id}/image`)
      .set(as(token))
      .attach('image', body, filename);
  const files = () =>
    readdir(join(uploads, 'rewards')).catch(() => [] as string[]);
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

  afterAll(async () => {
    await app.close();
    await removeUploadsDir(uploads);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const session = await sessionFor(app, Role.Teacher);
    teacher = session.token;
    rewardId = (await createReward(prisma, { createdBy: session.user.id })).id;
    await removeUploadsDir(join(uploads, 'rewards'));
  });

  it('sobe um PNG real, serve o arquivo e aparece no prêmio e na vitrine', async () => {
    const res = await upload(teacher, PNG_BYTES).expect(200);
    expect(res.body.image_url).toMatch(
      new RegExp(`^/uploads/rewards/${rewardId}-[0-9a-f-]{36}\\.png$`),
    );
    const served = await http()
      .get(res.body.image_url as string)
      .expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(Buffer.from(served.body as Buffer)).toEqual(PNG_BYTES);

    const reward = await http()
      .get(`/api/v1/rewards/${rewardId}`)
      .set(as(teacher))
      .expect(200);
    expect(reward.body.image_url).toBe(res.body.image_url);
    const student = await tokenFor(app, Role.Student);
    const store = await http()
      .get('/api/v1/store/rewards')
      .set(as(student))
      .expect(200);
    expect(store.body.data[0].image_url).toBe(res.body.image_url);
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
    expect(await files()).toEqual([]);
    expect(
      (await prisma.reward.findUniqueOrThrow({ where: { id: rewardId } }))
        .imagePath,
    ).toBeNull();
  });

  it('3 MB → 422; acima de 5 MB → 413; sem arquivo → 422; nada em disco', async () => {
    const big = await upload(teacher, padTo(PNG_BYTES, 3 * MB)).expect(422);
    expect(big.body.errors.image).toEqual([
      'A imagem deve ter no máximo 2 MB.',
    ]);
    const huge = await upload(teacher, padTo(PNG_BYTES, 6 * MB)).expect(413);
    expect(huge.body).toEqual({ message: 'Arquivo muito grande.' });
    const none = await http()
      .post(`/api/v1/rewards/${rewardId}/image`)
      .set(as(teacher))
      .send({})
      .expect(422);
    expect(none.body.errors.image).toEqual(['Envie uma imagem.']);
    expect(await files()).toEqual([]);
  });

  it('trocar apaga a anterior; DELETE apaga o arquivo e é idempotente', async () => {
    const first = await upload(teacher, PNG_BYTES).expect(200);
    const firstFile = (first.body.image_url as string).replace('/uploads/', '');
    const second = await upload(teacher, JPEG_BYTES, 'nova.jpg').expect(200);
    expect(await exists(join(uploads, firstFile))).toBe(false);
    expect(await files()).toHaveLength(1);

    await http()
      .delete(`/api/v1/rewards/${rewardId}/image`)
      .set(as(teacher))
      .expect(204);
    expect(await files()).toEqual([]);
    await http()
      .get(second.body.image_url as string)
      .expect(404);
    await http()
      .delete(`/api/v1/rewards/${rewardId}/image`)
      .set(as(teacher))
      .expect(204);
  });

  it('outro professor → 403 (nada gravado); administrador → 200', async () => {
    const other = await tokenFor(app, Role.Teacher);
    const res = await upload(other, PNG_BYTES).expect(403);
    expect(res.body).toEqual({
      message: 'Só quem cadastrou ou um administrador pode editar este prêmio.',
    });
    expect(await files()).toEqual([]);
    await upload(teacher, PNG_BYTES).expect(200);
    await http()
      .delete(`/api/v1/rewards/${rewardId}/image`)
      .set(as(other))
      .expect(403);
    expect(await files()).toHaveLength(1);

    const admin = await tokenFor(app, Role.Admin);
    await upload(admin, JPEG_BYTES, 'a.jpg').expect(200);
    expect(await files()).toHaveLength(1);
  });

  it('prêmio inexistente → 404; aluno → 403; sem token → 401', async () => {
    const res = await upload(teacher, PNG_BYTES, 'a.png', 999).expect(404);
    expect(res.body).toEqual({ message: 'Prêmio não encontrado.' });
    const student = await tokenFor(app, Role.Student);
    await upload(student, PNG_BYTES).expect(403);
    await http()
      .delete(`/api/v1/rewards/${rewardId}/image`)
      .set(as(student))
      .expect(403);
    await http()
      .post(`/api/v1/rewards/${rewardId}/image`)
      .attach('image', PNG_BYTES, 'a.png')
      .expect(401);
    expect(await files()).toEqual([]);
  });
});
