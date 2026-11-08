import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createCategory, createSubject } from './helpers/factories';
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

describe('Disciplinas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacher: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const valid = { name: 'Matemática', color: 'teal', icon: 'calculator' };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    teacher = await tokenFor(app, Role.Teacher);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria, lista, edita e exclui uma disciplina', async () => {
    const created = await http()
      .post('/api/v1/subjects')
      .set(as(teacher))
      .send(valid)
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(Number),
      name: 'Matemática',
      color: 'teal',
      icon: 'calculator',
      categories_count: 0,
      questions_count: 0,
    });
    const id = created.body.id as number;

    const list = await http()
      .get('/api/v1/subjects')
      .set(as(teacher))
      .expect(200);
    expect(list.body.data).toEqual([created.body]);

    const updated = await http()
      .put(`/api/v1/subjects/${id}`)
      .set(as(teacher))
      .send({ name: 'Matemática Básica', color: 'coral', icon: 'book' })
      .expect(200);
    expect(updated.body).toMatchObject({
      id,
      name: 'Matemática Básica',
      color: 'coral',
      icon: 'book',
    });

    await http().delete(`/api/v1/subjects/${id}`).set(as(teacher)).expect(204);
    expect(await prisma.subject.count()).toBe(0);
  });

  it('administrador também acessa', async () => {
    const admin = await tokenFor(app, Role.Admin);
    await http().get('/api/v1/subjects').set(as(admin)).expect(200);
  });

  it('lista ordenada por nome com a contagem de categorias', async () => {
    const zoologia = await createSubject(prisma, { name: 'Zoologia' });
    const artes = await createSubject(prisma, { name: 'Artes' });
    await createCategory(prisma, { subjectId: artes.id });
    await createCategory(prisma, { subjectId: artes.id });
    await createCategory(prisma, { subjectId: zoologia.id });

    const { body } = await http()
      .get('/api/v1/subjects')
      .set(as(teacher))
      .expect(200);

    expect(
      body.data.map(
        (s: {
          name: string;
          categories_count: number;
          questions_count: number;
        }) => [s.name, s.categories_count, s.questions_count],
      ),
    ).toEqual([
      ['Artes', 2, 0],
      ['Zoologia', 1, 0],
    ]);
  });

  it('aluno recebe 403 em todas as rotas', async () => {
    const student = await tokenFor(app, Role.Student);
    const subject = await createSubject(prisma);
    await http().get('/api/v1/subjects').set(as(student)).expect(403);
    await http()
      .post('/api/v1/subjects')
      .set(as(student))
      .send(valid)
      .expect(403);
    await http()
      .put(`/api/v1/subjects/${subject.id}`)
      .set(as(student))
      .send(valid)
      .expect(403);
    await http()
      .delete(`/api/v1/subjects/${subject.id}`)
      .set(as(student))
      .expect(403);
    expect(await prisma.subject.count()).toBe(1);
  });

  it('sem login recebe 401', async () => {
    await http().get('/api/v1/subjects').expect(401);
  });

  it('nome que só difere em maiúsculas e espaços → 422 de duplicidade', async () => {
    await createSubject(prisma, { name: 'Matemática' });

    const { body } = await http()
      .post('/api/v1/subjects')
      .set(as(teacher))
      .send({ ...valid, name: '  matemática ' })
      .expect(422);

    expect(body.errors.name).toEqual([
      'Já existe uma disciplina com esse nome.',
    ]);
    expect(await prisma.subject.count()).toBe(1);
  });

  it('editar para o nome de outra disciplina → 422; manter o próprio nome → 200', async () => {
    await createSubject(prisma, { name: 'Matemática' });
    const other = await createSubject(prisma, { name: 'Física' });

    const { body } = await http()
      .put(`/api/v1/subjects/${other.id}`)
      .set(as(teacher))
      .send({ ...valid, name: 'MATEMÁTICA' })
      .expect(422);
    expect(body.errors.name).toEqual([
      'Já existe uma disciplina com esse nome.',
    ]);

    await http()
      .put(`/api/v1/subjects/${other.id}`)
      .set(as(teacher))
      .send({ ...valid, name: 'física' })
      .expect(200);
  });

  it('valida nome, cor e ícone', async () => {
    const short = await http()
      .post('/api/v1/subjects')
      .set(as(teacher))
      .send({ name: ' a ', color: 'verde', icon: 'foguete' })
      .expect(422);
    expect(short.body.errors).toEqual({
      name: ['O nome deve ter pelo menos 2 caracteres.'],
      color: ['Escolha uma cor válida.'],
      icon: ['Escolha um ícone válido.'],
    });

    const long = await http()
      .post('/api/v1/subjects')
      .set(as(teacher))
      .send({ ...valid, name: 'x'.repeat(61) })
      .expect(422);
    expect(long.body.errors.name).toEqual([
      'O nome deve ter no máximo 60 caracteres.',
    ]);

    const empty = await http()
      .post('/api/v1/subjects')
      .set(as(teacher))
      .send({})
      .expect(422);
    expect(Object.keys(empty.body.errors).sort()).toEqual([
      'color',
      'icon',
      'name',
    ]);
    expect(await prisma.subject.count()).toBe(0);
  });

  it('PUT de id inexistente ou inválido → 404', async () => {
    const { body } = await http()
      .put('/api/v1/subjects/999')
      .set(as(teacher))
      .send(valid)
      .expect(404);
    expect(body.message).toBe('Disciplina não encontrada.');
    await http()
      .put('/api/v1/subjects/abc')
      .set(as(teacher))
      .send(valid)
      .expect(404);
    await http()
      .put('/api/v1/subjects/99999999999')
      .set(as(teacher))
      .send(valid)
      .expect(404);
  });

  it('DELETE de id inexistente → 404', async () => {
    const { body } = await http()
      .delete('/api/v1/subjects/999')
      .set(as(teacher))
      .expect(404);
    expect(body.message).toBe('Disciplina não encontrada.');
  });

  it('excluir disciplina com categoria → 409 e ela continua existindo', async () => {
    const subject = await createSubject(prisma);
    await createCategory(prisma, { subjectId: subject.id });

    const { body } = await http()
      .delete(`/api/v1/subjects/${subject.id}`)
      .set(as(teacher))
      .expect(409);

    expect(body.message).toBe(
      'Não é possível excluir: a disciplina tem categorias ou questões.',
    );
    expect(await prisma.subject.count()).toBe(1);
    expect(await prisma.category.count()).toBe(1);
  });
});
