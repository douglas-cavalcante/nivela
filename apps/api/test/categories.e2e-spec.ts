import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/shared/enums/role.enum';
import { createTestApp } from './helpers/create-test-app';
import { createCategory, createSubject } from './helpers/factories';
import { tokenFor } from './helpers/login';
import { resetDatabase } from './helpers/reset-database';

describe('Categorias (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let teacher: string;

  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

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

  it('cria, lista, edita e exclui uma categoria', async () => {
    const subject = await createSubject(prisma, {
      name: 'Matemática',
      color: 'violet',
    });

    const created = await http()
      .post('/api/v1/categories')
      .set(as(teacher))
      .send({ subject_id: subject.id, name: 'Frações' })
      .expect(201);
    expect(created.body).toEqual({
      id: expect.any(Number),
      name: 'Frações',
      subject: { id: subject.id, name: 'Matemática', color: 'violet' },
      questions_count: 0,
    });
    const id = created.body.id as number;

    const list = await http()
      .get('/api/v1/categories')
      .set(as(teacher))
      .expect(200);
    expect(list.body.data).toEqual([created.body]);

    const updated = await http()
      .put(`/api/v1/categories/${id}`)
      .set(as(teacher))
      .send({ name: 'Frações e decimais' })
      .expect(200);
    expect(updated.body).toMatchObject({ id, name: 'Frações e decimais' });

    await http()
      .delete(`/api/v1/categories/${id}`)
      .set(as(teacher))
      .expect(204);
    expect(await prisma.category.count()).toBe(0);
    expect(await prisma.subject.count()).toBe(1);
  });

  it('aluno recebe 403 em todas as rotas', async () => {
    const student = await tokenFor(app, Role.Student);
    const category = await createCategory(prisma);
    await http().get('/api/v1/categories').set(as(student)).expect(403);
    await http()
      .post('/api/v1/categories')
      .set(as(student))
      .send({ subject_id: category.subjectId, name: 'Outra' })
      .expect(403);
    await http()
      .put(`/api/v1/categories/${category.id}`)
      .set(as(student))
      .send({ name: 'Nova' })
      .expect(403);
    await http()
      .delete(`/api/v1/categories/${category.id}`)
      .set(as(student))
      .expect(403);
    expect(await prisma.category.count()).toBe(1);
  });

  it('lista por disciplina e nome e filtra por subject_id', async () => {
    const biologia = await createSubject(prisma, { name: 'Biologia' });
    const artes = await createSubject(prisma, { name: 'Artes' });
    await createCategory(prisma, { subjectId: biologia.id, name: 'Células' });
    await createCategory(prisma, { subjectId: artes.id, name: 'Pintura' });
    await createCategory(prisma, { subjectId: biologia.id, name: 'Ecologia' });

    const all = await http()
      .get('/api/v1/categories')
      .set(as(teacher))
      .expect(200);
    expect(
      all.body.data.map((c: { subject: { name: string }; name: string }) => [
        c.subject.name,
        c.name,
      ]),
    ).toEqual([
      ['Artes', 'Pintura'],
      ['Biologia', 'Células'],
      ['Biologia', 'Ecologia'],
    ]);

    const filtered = await http()
      .get(`/api/v1/categories?subject_id=${biologia.id}`)
      .set(as(teacher))
      .expect(200);
    expect(filtered.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Células',
      'Ecologia',
    ]);

    const none = await http()
      .get('/api/v1/categories?subject_id=9999')
      .set(as(teacher))
      .expect(200);
    expect(none.body.data).toEqual([]);
  });

  it('subject_id não numérico na listagem → 422', async () => {
    const { body } = await http()
      .get('/api/v1/categories?subject_id=abc')
      .set(as(teacher))
      .expect(422);
    expect(body.errors.subject_id).toEqual([
      'A disciplina deve ser um número inteiro.',
    ]);
  });

  it('disciplina inexistente ao criar → 422 em subject_id', async () => {
    const { body } = await http()
      .post('/api/v1/categories')
      .set(as(teacher))
      .send({ subject_id: 999, name: 'Frações' })
      .expect(422);
    expect(body.errors.subject_id).toEqual(['Disciplina não encontrada.']);
    expect(await prisma.category.count()).toBe(0);
  });

  it('valida nome e disciplina', async () => {
    const { body } = await http()
      .post('/api/v1/categories')
      .set(as(teacher))
      .send({ subject_id: 'x', name: ' a ' })
      .expect(422);
    expect(body.errors).toEqual({
      subject_id: ['Escolha uma disciplina válida.'],
      name: ['O nome deve ter pelo menos 2 caracteres.'],
    });
    const subject = await createSubject(prisma);
    const long = await http()
      .post('/api/v1/categories')
      .set(as(teacher))
      .send({ subject_id: subject.id, name: 'x'.repeat(81) })
      .expect(422);
    expect(long.body.errors.name).toEqual([
      'O nome deve ter no máximo 80 caracteres.',
    ]);
  });

  it('nome repetido na mesma disciplina (ignorando caixa e espaços) → 422', async () => {
    const subject = await createSubject(prisma);
    await createCategory(prisma, { subjectId: subject.id, name: 'Frações' });

    const { body } = await http()
      .post('/api/v1/categories')
      .set(as(teacher))
      .send({ subject_id: subject.id, name: ' frações ' })
      .expect(422);

    expect(body.errors.name).toEqual([
      'Já existe uma categoria com esse nome nessa disciplina.',
    ]);
    expect(await prisma.category.count()).toBe(1);
  });

  it('mesmo nome em disciplinas diferentes → OK', async () => {
    const a = await createSubject(prisma);
    const b = await createSubject(prisma);
    await createCategory(prisma, { subjectId: a.id, name: 'Introdução' });

    await http()
      .post('/api/v1/categories')
      .set(as(teacher))
      .send({ subject_id: b.id, name: 'Introdução' })
      .expect(201);
  });

  it('editar: duplicidade → 422; mudar a disciplina é ignorado', async () => {
    const a = await createSubject(prisma);
    const b = await createSubject(prisma);
    await createCategory(prisma, { subjectId: a.id, name: 'Frações' });
    const other = await createCategory(prisma, {
      subjectId: a.id,
      name: 'Geometria',
    });

    const dup = await http()
      .put(`/api/v1/categories/${other.id}`)
      .set(as(teacher))
      .send({ name: 'FRAÇÕES' })
      .expect(422);
    expect(dup.body.errors.name).toEqual([
      'Já existe uma categoria com esse nome nessa disciplina.',
    ]);

    const moved = await http()
      .put(`/api/v1/categories/${other.id}`)
      .set(as(teacher))
      .send({ name: 'Geometria plana', subject_id: b.id })
      .expect(200);
    expect(moved.body.subject.id).toBe(a.id);
    const stored = await prisma.category.findUniqueOrThrow({
      where: { id: other.id },
    });
    expect(stored.subjectId).toBe(a.id);
  });

  it('PUT e DELETE de id inexistente → 404', async () => {
    const put = await http()
      .put('/api/v1/categories/999')
      .set(as(teacher))
      .send({ name: 'Nova' })
      .expect(404);
    expect(put.body.message).toBe('Categoria não encontrada.');
    const del = await http()
      .delete('/api/v1/categories/999')
      .set(as(teacher))
      .expect(404);
    expect(del.body.message).toBe('Categoria não encontrada.');
  });
});
